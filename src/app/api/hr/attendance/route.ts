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

// Helper: get the start of the day in UTC for a given date
function startOfDayUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

// Helper: calculate hours between two dates
function calculateHours(clockIn: Date, clockOut: Date): number {
  const diffMs = clockOut.getTime() - clockIn.getTime();
  return Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
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
  let targetUserId = user.userId;

  if (queryUserId && queryUserId !== user.userId) {
    // Non-managers can only view their own records
    if (!MANAGER_ROLES.includes(user.role)) {
      return NextResponse.json(
        { error: "You can only view your own attendance records" },
        { status: 403 }
      );
    }
    targetUserId = queryUserId;
  }

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

  const where: Record<string, unknown> = { userId: targetUserId };
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

  // Find active session: today's record with no clockOut
  const today = startOfDayUTC(new Date());
  const activeSession = await db.attendance.findUnique({
    where: {
      userId_date: {
        userId: targetUserId,
        date: today,
      },
    },
  });

  return NextResponse.json({
    records,
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

  // Auto-clock-out scenario: session exceeds 14 hours
  if (sessionDurationHours > MAX_SESSION_HOURS) {
    // Auto-close the stale session at clockIn + 14 hours, flag it
    const autoClockOut = new Date(
      existingSession.clockIn.getTime() + MAX_SESSION_HOURS * 60 * 60 * 1000
    );

    await db.attendance.update({
      where: { id: existingSession.id },
      data: {
        clockOut: autoClockOut,
        totalHours: MAX_SESSION_HOURS,
        autoClocked: true,
        flagged: true,
        notes: existingSession.notes
          ? `${existingSession.notes} | Auto-clocked out after ${MAX_SESSION_HOURS}h`
          : `Auto-clocked out after ${MAX_SESSION_HOURS}h`,
      },
    });

    // Start a new session for today — but the unique constraint
    // (userId, date) prevents a second record on the same date.
    // So we return the auto-clocked record and inform the user.
    const updatedRecord = await db.attendance.findUnique({
      where: { id: existingSession.id },
    });

    return NextResponse.json(
      {
        record: updatedRecord,
        action: "auto_clock_out",
        message: `Previous session exceeded ${MAX_SESSION_HOURS} hours and was auto-clocked out and flagged. Please clock in again tomorrow.`,
      },
      { status: 200 }
    );
  }

  // Normal clock out
  const record = await db.attendance.update({
    where: { id: existingSession.id },
    data: {
      clockOut: now,
      totalHours: sessionDurationHours,
      ...(notes ? { notes: existingSession.notes ? `${existingSession.notes} | ${notes}` : notes } : {}),
    },
  });

  return NextResponse.json({ record, action: "clock_out" });
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
