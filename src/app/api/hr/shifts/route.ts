import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { Role, ShiftType, LeaveStatus } from "@/generated/prisma/enums";

// ---------------------------------------------------------------------------
// GET /api/hr/shifts?month=YYYY-MM&userId=...
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const { user, error } = await requireRole(
    Role.SUPER_ADMIN,
    Role.ADMIN_MANAGER,
    Role.SALES_MANAGER,
    Role.ADMIN,
    Role.SALES
  );
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");
  const userIdParam = searchParams.get("userId");

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json(
      { error: "Query param 'month' is required in YYYY-MM format" },
      { status: 400 }
    );
  }

  // Build date range for the requested month
  const [year, mon] = month.split("-").map(Number);
  const startDate = new Date(Date.UTC(year, mon - 1, 1));
  const endDate = new Date(Date.UTC(year, mon, 1)); // first day of next month

  // Determine whose shifts to fetch
  const canViewOthers =
    user.role === Role.SUPER_ADMIN ||
    user.role === Role.ADMIN_MANAGER ||
    user.role === Role.SALES_MANAGER;

  let targetUserId: string | undefined;

  if (canViewOthers) {
    // Managers / super-admin can optionally filter by userId
    targetUserId = userIdParam ?? undefined;
  } else {
    // SALES / ADMIN can only see their own shifts
    targetUserId = user.userId;
  }

  const shifts = await db.shift.findMany({
    where: {
      date: { gte: startDate, lt: endDate },
      ...(targetUserId ? { userId: targetUserId } : {}),
    },
    include: {
      user: { select: { id: true, name: true } },
    },
    orderBy: { date: "asc" },
  });

  return NextResponse.json({ shifts });
}

// ---------------------------------------------------------------------------
// POST /api/hr/shifts — Create or update a shift (upsert)
// ---------------------------------------------------------------------------
const shiftBodySchema = z.object({
  userId: z.string().min(1, "userId is required"),
  date: z.string().min(1, "date is required"), // ISO date string
  type: z.nativeEnum(ShiftType),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const { user, error } = await requireRole(Role.SUPER_ADMIN);
  if (error) return error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = shiftBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { userId, date, type, startTime, endTime, notes } = parsed.data;

  // Normalise date to UTC midnight
  const shiftDate = new Date(date + "T00:00:00.000Z");
  if (isNaN(shiftDate.getTime())) {
    return NextResponse.json(
      { error: "Invalid date format" },
      { status: 400 }
    );
  }

  // CRITICAL: Check for approved leave covering this date
  const approvedLeave = await db.leaveRequest.findFirst({
    where: {
      userId,
      status: LeaveStatus.APPROVED,
      startDate: { lte: shiftDate },
      endDate: { gte: shiftDate },
    },
  });

  if (approvedLeave) {
    return NextResponse.json(
      { error: "Employee has approved leave on this date" },
      { status: 409 }
    );
  }

  // Upsert: create or update based on unique (userId, date)
  const shift = await db.shift.upsert({
    where: { userId_date: { userId, date: shiftDate } },
    create: {
      userId,
      date: shiftDate,
      type,
      startTime: startTime ?? null,
      endTime: endTime ?? null,
      notes: notes ?? null,
    },
    update: {
      type,
      startTime: startTime ?? null,
      endTime: endTime ?? null,
      notes: notes ?? null,
    },
    include: {
      user: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ shift }, { status: 200 });
}

// ---------------------------------------------------------------------------
// DELETE /api/hr/shifts?id=...
// ---------------------------------------------------------------------------
export async function DELETE(request: NextRequest) {
  const { user, error } = await requireRole(Role.SUPER_ADMIN);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { error: "Query param 'id' is required" },
      { status: 400 }
    );
  }

  const existing = await db.shift.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Shift not found" }, { status: 404 });
  }

  await db.shift.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
