import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { Role } from "@/generated/prisma/enums";

const ALL_ROLES = [
  Role.SUPER_ADMIN,
  Role.SALES_MANAGER,
  Role.ADMIN_MANAGER,
  Role.SALES,
  Role.ADMIN,
] as const;

const MANAGER_ROLES: Role[] = [
  Role.SUPER_ADMIN,
  Role.SALES_MANAGER,
  Role.ADMIN_MANAGER,
];

const MAX_SESSION_HOURS = 14;
const DEFAULT_SHIFT_MAX_HOURS = 8;  // Default: 09:00–17:00 = 8h
const DEFAULT_SHIFT_END = "17:00";  // Default shift end time
const GRACE_PERIOD_HOURS = 1;       // Wait 1h after shift end before auto-clocking out

// Helper: get the start of the day in UTC for a given date
function startOfDayUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

// Helper: calculate hours between two dates
function calculateHours(clockIn: Date, clockOut: Date): number {
  const diffMs = clockOut.getTime() - clockIn.getTime();
  return Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
}

// Helper: calculate shift duration in hours from startTime/endTime strings ("HH:MM")
function shiftDurationHours(startTime: string | null, endTime: string | null): number {
  if (!startTime || !endTime) return DEFAULT_SHIFT_MAX_HOURS;
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const startMins = sh * 60 + sm;
  const endMins = eh * 60 + em;
  const diff = endMins - startMins;
  return diff > 0 ? diff / 60 : DEFAULT_SHIFT_MAX_HOURS;
}

// Helper: build a Date for the shift end time on a given day
function shiftEndDateTime(dayDate: Date, endTime: string | null): Date {
  const time = endTime || DEFAULT_SHIFT_END;
  const [h, m] = time.split(":").map(Number);
  return new Date(Date.UTC(
    dayDate.getUTCFullYear(),
    dayDate.getUTCMonth(),
    dayDate.getUTCDate(),
    h, m, 0
  ));
}

// GET /api/hr/attendance — Fetch attendance records
export async function GET(request: NextRequest) {
  const { user, error } = await requireRole(...ALL_ROLES);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const queryUserId = searchParams.get("userId");
  const month = searchParams.get("month"); // YYYY-MM
  const date = searchParams.get("date"); // YYYY-MM-DD

  // Determine whose records to fetch
  // Managers calling without a userId see ALL employees.
  // Non-managers always see only their own.
  const isManagerOrAbove = MANAGER_ROLES.includes(user.role as Role);
  let targetUserId: string | null = null;

  if (queryUserId) {
    // Explicit userId requested
    if (queryUserId !== user.userId && !isManagerOrAbove) {
      return NextResponse.json(
        { error: "You can only view your own attendance records" },
        { status: 403 }
      );
    }
    targetUserId = queryUserId;
  } else if (!isManagerOrAbove) {
    // Non-managers default to own records
    targetUserId = user.userId;
  }
  // else: manager with no userId → targetUserId stays null → fetch all

  // Build date filter
  let dateFilter: { gte?: Date; lte?: Date } = {};

  if (date) {
    const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
    const parsed = dateSchema.safeParse(date);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid date format. Use YYYY-MM-DD" },
        { status: 400 }
      );
    }
    const d = new Date(date + "T00:00:00.000Z");
    if (isNaN(d.getTime())) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    }
    dateFilter = { gte: d, lte: d };
  } else if (month) {
    const monthSchema = z.string().regex(/^\d{4}-\d{2}$/);
    const parsed = monthSchema.safeParse(month);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid month format. Use YYYY-MM" },
        { status: 400 }
      );
    }
    const [year, mon] = month.split("-").map(Number);
    const start = new Date(Date.UTC(year, mon - 1, 1));
    const end = new Date(Date.UTC(year, mon, 0)); // last day of month
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json({ error: "Invalid month" }, { status: 400 });
    }
    dateFilter = { gte: start, lte: end };
  }

  const where: Record<string, unknown> = {};
  if (targetUserId) {
    where.userId = targetUserId;
  }
  if (dateFilter.gte || dateFilter.lte) {
    where.date = dateFilter;
  }

  const records = await db.attendance.findMany({
    where,
    orderBy: { date: "desc" },
    include: {
      user: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  // Look up shifts for all (userId, date) pairs in the result set
  // so we can cap hours to the assigned shift duration.
  const shiftKeys = records.map((r) => ({
    userId: r.userId,
    date: r.date,
  }));

  const shifts =
    shiftKeys.length > 0
      ? await db.shift.findMany({
          where: {
            OR: shiftKeys.map((k) => ({
              userId: k.userId,
              date: k.date,
            })),
          },
          select: {
            userId: true,
            date: true,
            startTime: true,
            endTime: true,
          },
        })
      : [];

  // Build lookup maps: "userId|dateISO" → shift info
  const shiftMap = new Map<string, { duration: number; endTime: string | null }>();
  for (const s of shifts) {
    const key = `${s.userId}|${s.date.toISOString()}`;
    shiftMap.set(key, {
      duration: shiftDurationHours(s.startTime, s.endTime),
      endTime: s.endTime,
    });
  }

  const now = new Date();

  // ── Auto-clock-out stale sessions ──────────────────────────────────────
  // If an employee forgot to clock out and it's been 1 hour past their
  // shift end, automatically clock them out at shift end time and cap
  // their hours to the shift duration. Written directly to the DB.
  const staleIds = new Set<string>();

  for (const r of records) {
    if (r.clockOut) continue; // already clocked out

    const key = `${r.userId}|${r.date.toISOString()}`;
    const shift = shiftMap.get(key);
    const maxHours = shift?.duration ?? DEFAULT_SHIFT_MAX_HOURS;
    const endTime = shift?.endTime ?? null;

    const shiftEnd = shiftEndDateTime(r.date, endTime);
    const graceDeadline = new Date(shiftEnd.getTime() + GRACE_PERIOD_HOURS * 60 * 60 * 1000);

    // Past grace period → auto-clock out at shift end
    if (now > graceDeadline) {
      staleIds.add(r.id);
      const rawElapsed = calculateHours(r.clockIn, now);
      await db.attendance.update({
        where: { id: r.id },
        data: {
          clockOut: shiftEnd,
          totalHours: maxHours,
          autoClocked: true,
          flagged: true,
          onBreak: false,
          notes: r.notes
            ? `${r.notes} | Auto-clocked out at shift end (${endTime || DEFAULT_SHIFT_END}). Actual elapsed: ${rawElapsed.toFixed(1)}h`
            : `Auto-clocked out at shift end (${endTime || DEFAULT_SHIFT_END}). Actual elapsed: ${rawElapsed.toFixed(1)}h`,
        },
      });
    }
  }

  // Re-fetch if any records were auto-clocked out so we return fresh data
  const finalRecords = staleIds.size > 0
    ? await db.attendance.findMany({
        where,
        orderBy: { date: "desc" },
        include: { user: { select: { id: true, name: true, email: true } } },
      })
    : records;

  // ── Enrich records with capped hours for display ───────────────────────
  const enrichedRecords = finalRecords.map((r) => {
    const key = `${r.userId}|${r.date.toISOString()}`;
    const shift = shiftMap.get(key);
    const maxHours = shift?.duration ?? DEFAULT_SHIFT_MAX_HOURS;
    const rawHours = r.totalHours;

    // Still active (within grace period) — show live elapsed
    if (!r.clockOut) {
      const elapsed = calculateHours(r.clockIn, now);
      return {
        ...r,
        cappedHours: null,
        rawHours: Math.round(elapsed * 100) / 100,
        autoCorrected: false,
        shiftMaxHours: maxHours,
      };
    }

    // Completed: actual hours exceed shift max → show capped
    if (rawHours !== null && rawHours > maxHours) {
      return {
        ...r,
        cappedHours: maxHours,
        rawHours,
        autoCorrected: true,
        shiftMaxHours: maxHours,
      };
    }

    // Auto-clocked sessions (just written above, or from previous runs)
    const wasAutoCorrected = staleIds.has(r.id) || (r.autoClocked && r.flagged);

    return {
      ...r,
      cappedHours: rawHours,
      rawHours,
      autoCorrected: wasAutoCorrected,
      shiftMaxHours: maxHours,
    };
  });

  // Find active session for the current user (always their own)
  const today = startOfDayUTC(new Date());
  const activeSession = await db.attendance.findUnique({
    where: {
      userId_date: {
        userId: user.userId,
        date: today,
      },
    },
  });

  return NextResponse.json({
    records: enrichedRecords,
    activeSession: activeSession && !activeSession.clockOut ? activeSession : null,
  });
}

// POST /api/hr/attendance — Clock In / Clock Out (toggle)
export async function POST(request: NextRequest) {
  const { user, error } = await requireRole(...ALL_ROLES);
  if (error) return error;

  const body = await request.json().catch(() => ({}));
  const notes = typeof body.notes === "string" ? body.notes.trim() : null;

  const now = new Date();
  const today = startOfDayUTC(now);

  // Check for an existing session today
  const existingSession = await db.attendance.findUnique({
    where: {
      userId_date: {
        userId: user.userId,
        date: today,
      },
    },
  });

  // --- No session today: Clock In ---
  if (!existingSession) {
    const record = await db.attendance.create({
      data: {
        userId: user.userId,
        clockIn: now,
        date: today,
        ...(notes ? { notes } : {}),
      },
    });

    return NextResponse.json({ record, action: "clock_in" }, { status: 201 });
  }

  // --- Session exists and already clocked out: already completed for today ---
  if (existingSession.clockOut) {
    return NextResponse.json(
      { error: "You have already clocked in and out today. A new session cannot be started for the same date." },
      { status: 409 }
    );
  }

  // --- Active session exists (clockOut is null) ---
  const sessionDurationHours = calculateHours(existingSession.clockIn, now);

  // Look up the assigned shift for this user+date to determine the cap
  const assignedShift = await db.shift.findUnique({
    where: {
      userId_date: {
        userId: user.userId,
        date: today,
      },
    },
    select: { startTime: true, endTime: true },
  });

  const shiftMax = assignedShift
    ? shiftDurationHours(assignedShift.startTime, assignedShift.endTime)
    : DEFAULT_SHIFT_MAX_HOURS;

  // Hard ceiling: session exceeds 14 hours (absolute safety net)
  if (sessionDurationHours > MAX_SESSION_HOURS) {
    const shiftEnd = shiftEndDateTime(today, assignedShift?.endTime ?? null);

    await db.attendance.update({
      where: { id: existingSession.id },
      data: {
        clockOut: shiftEnd,
        totalHours: shiftMax,
        autoClocked: true,
        flagged: true,
        notes: existingSession.notes
          ? `${existingSession.notes} | Auto-clocked out at shift end. Actual: ${sessionDurationHours.toFixed(1)}h`
          : `Auto-clocked out at shift end. Actual: ${sessionDurationHours.toFixed(1)}h`,
      },
    });

    const updatedRecord = await db.attendance.findUnique({
      where: { id: existingSession.id },
    });

    return NextResponse.json(
      {
        record: updatedRecord,
        action: "auto_clock_out",
        autoCorrected: true,
        message: `Session exceeded ${MAX_SESSION_HOURS}h. Auto-clocked out at shift end (${assignedShift?.endTime || DEFAULT_SHIFT_END}) with ${shiftMax}h recorded.`,
      },
      { status: 200 }
    );
  }

  const exceededShift = sessionDurationHours > shiftMax;
  const finalHours = exceededShift ? shiftMax : sessionDurationHours;

  // Normal clock out — cap to shift duration if exceeded
  const record = await db.attendance.update({
    where: { id: existingSession.id },
    data: {
      clockOut: now,
      totalHours: finalHours,
      flagged: exceededShift ? true : existingSession.flagged,
      autoClocked: exceededShift ? true : existingSession.autoClocked,
      ...(exceededShift
        ? {
            notes: existingSession.notes
              ? `${existingSession.notes} | Auto-capped from ${sessionDurationHours.toFixed(1)}h to ${shiftMax}h (shift limit)`
              : `Auto-capped from ${sessionDurationHours.toFixed(1)}h to ${shiftMax}h (shift limit)`,
          }
        : notes
          ? { notes: existingSession.notes ? `${existingSession.notes} | ${notes}` : notes }
          : {}),
    },
  });

  return NextResponse.json({
    record,
    action: "clock_out",
    ...(exceededShift
      ? {
          autoCorrected: true,
          message: `Hours exceeded shift limit (${shiftMax}h). Capped from ${sessionDurationHours.toFixed(1)}h to ${shiftMax}h.`,
        }
      : {}),
  });
}

// PATCH /api/hr/attendance — Start Break / End Break
export async function PATCH(request: NextRequest) {
  const { user, error } = await requireRole(...ALL_ROLES);
  if (error) return error;

  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action; // "start_break" or "end_break"

    if (!["start_break", "end_break"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Use 'start_break' or 'end_break'" },
        { status: 400 }
      );
    }

    const now = new Date();
    const today = startOfDayUTC(now);

    const session = await db.attendance.findUnique({
      where: { userId_date: { userId: user.userId, date: today } },
    });

    if (!session || session.clockOut) {
      return NextResponse.json(
        { error: "No active session. You must be clocked in to manage breaks." },
        { status: 400 }
      );
    }

    if (action === "start_break") {
      if (session.onBreak) {
        return NextResponse.json(
          { error: "You are already on break" },
          { status: 409 }
        );
      }

      const record = await db.attendance.update({
        where: { id: session.id },
        data: { breakStart: now, onBreak: true },
      });

      return NextResponse.json({ record, action: "start_break" });
    }

    // end_break
    if (!session.onBreak || !session.breakStart) {
      return NextResponse.json(
        { error: "You are not currently on break" },
        { status: 409 }
      );
    }

    const breakDuration = calculateHours(session.breakStart, now);
    const totalBreak = Math.round(((session.breakHours || 0) + breakDuration) * 100) / 100;

    const record = await db.attendance.update({
      where: { id: session.id },
      data: {
        breakEnd: now,
        onBreak: false,
        breakHours: totalBreak,
      },
    });

    return NextResponse.json({ record, action: "end_break" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Break update failed";
    console.error("PATCH /api/hr/attendance error:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? message : "Break update failed" },
      { status: 500 }
    );
  }
}
