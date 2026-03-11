import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { Role, LeaveType, LeaveStatus } from "@/generated/prisma/enums";

// Roles that can see all fields for all users
const MANAGER_ROLES: Role[] = [
  Role.SUPER_ADMIN,
  Role.SALES_MANAGER,
  Role.ADMIN_MANAGER,
];

// Sales-side roles (visible to SALES_MANAGER)
const SALES_TEAM_ROLES: Role[] = [Role.SALES, Role.SALES_MANAGER];

// ---------------------------------------------------------------------------
// GET /api/hr/leave — Fetch leave requests with privacy & team scoping
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const { user, error } = await requireRole(
    Role.SALES,
    Role.ADMIN,
    Role.SALES_MANAGER,
    Role.ADMIN_MANAGER,
    Role.SUPER_ADMIN
  );
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const status = searchParams.get("status");
  const month = searchParams.get("month"); // YYYY-MM
  const scope = searchParams.get("scope"); // "personal" | "team"

  const where: Record<string, unknown> = {};

  // Scope filtering
  if (scope === "personal") {
    // Only the current user's own leave
    where.userId = user.userId;
  } else if (scope === "team") {
    // Team scoping based on role
    if (user.role === Role.SALES_MANAGER) {
      // Sales Manager: only see SALES + SALES_MANAGER leave
      const salesUsers = await db.user.findMany({
        where: { role: { in: SALES_TEAM_ROLES } },
        select: { id: true },
      });
      where.userId = { in: salesUsers.map((u) => u.id) };
    }
    // ADMIN_MANAGER and SUPER_ADMIN: see all (no userId filter)
  } else if (userId) {
    where.userId = userId;
  }

  if (status) {
    where.status = status;
  }

  if (month) {
    const [year, mon] = month.split("-").map(Number);
    const start = new Date(year, mon - 1, 1);
    const end = new Date(year, mon, 1);
    where.startDate = { lte: end };
    where.endDate = { gte: start };
  }

  const records = await db.leaveRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, name: true, role: true, division: true } },
      reviewedBy: { select: { name: true } },
    },
  });

  const isManagerOrAbove = MANAGER_ROLES.includes(user.role as Role);

  const results = records.map((r) => {
    // Own records — always show full details
    if (r.userId === user.userId) return r;

    // Regular ADMIN/SALES cannot see reason or medical for others
    if (!isManagerOrAbove) {
      return {
        ...r,
        reason: null,
        medicalFileUrl: null,
        medicalFileKey: null,
      };
    }

    // Managers can see reason, but only SUPER_ADMIN sees medical files
    if (user.role !== Role.SUPER_ADMIN) {
      return {
        ...r,
        medicalFileUrl: null,
        medicalFileKey: null,
      };
    }

    return r;
  });

  return NextResponse.json({ leaveRequests: results });
}

// ---------------------------------------------------------------------------
// POST /api/hr/leave — Create a leave request (any role, for themselves)
// ---------------------------------------------------------------------------
const createLeaveSchema = z.object({
  type: z.nativeEnum(LeaveType),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  reason: z.string().optional(),
  medicalFileUrl: z.string().optional(),
  medicalFileKey: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const { user, error } = await requireRole(
    Role.SALES,
    Role.ADMIN,
    Role.SALES_MANAGER,
    Role.ADMIN_MANAGER,
    Role.SUPER_ADMIN
  );
  if (error) return error;

  try {
    const body = await request.json();
    const data = createLeaveSchema.parse(body);

    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);

    if (endDate < startDate) {
      return NextResponse.json(
        { error: "End date must be on or after start date" },
        { status: 400 }
      );
    }

    // Check for overlapping approved or pending leave for the same user
    const overlap = await db.leaveRequest.findFirst({
      where: {
        userId: user.userId,
        status: { in: [LeaveStatus.PENDING, LeaveStatus.APPROVED] },
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
    });

    if (overlap) {
      return NextResponse.json(
        {
          error:
            "You already have an overlapping leave request (pending or approved) for these dates",
        },
        { status: 409 }
      );
    }

    const leaveRequest = await db.leaveRequest.create({
      data: {
        type: data.type,
        startDate,
        endDate,
        reason: data.reason || null,
        medicalFileUrl: data.medicalFileUrl || null,
        medicalFileKey: data.medicalFileKey || null,
        userId: user.userId,
      },
      include: {
        user: { select: { name: true } },
      },
    });

    return NextResponse.json({ leaveRequest }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: err.issues },
        { status: 400 }
      );
    }
    console.error("Create leave request error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/hr/leave — Approve or reject a leave request (managers only)
// ---------------------------------------------------------------------------
const reviewLeaveSchema = z.object({
  id: z.string().min(1, "Leave request ID is required"),
  status: z.enum([LeaveStatus.APPROVED, LeaveStatus.REJECTED]),
  reviewNotes: z.string().optional(),
});

export async function PATCH(request: NextRequest) {
  const { user, error } = await requireRole(
    Role.SUPER_ADMIN,
    Role.SALES_MANAGER,
    Role.ADMIN_MANAGER
  );
  if (error) return error;

  try {
    const body = await request.json();
    const data = reviewLeaveSchema.parse(body);

    const leaveRequest = await db.leaveRequest.findUnique({
      where: { id: data.id },
    });

    if (!leaveRequest) {
      return NextResponse.json(
        { error: "Leave request not found" },
        { status: 404 }
      );
    }

    if (leaveRequest.status !== LeaveStatus.PENDING) {
      return NextResponse.json(
        { error: "Only pending leave requests can be approved or rejected" },
        { status: 400 }
      );
    }

    const updated = await db.$transaction(async (tx) => {
      const result = await tx.leaveRequest.update({
        where: { id: data.id },
        data: {
          status: data.status,
          reviewNotes: data.reviewNotes || null,
          reviewedById: user.userId,
          reviewedAt: new Date(),
        },
        include: {
          user: { select: { name: true } },
          reviewedBy: { select: { name: true } },
        },
      });

      // If approved, remove any conflicting shifts on the leave dates
      if (data.status === LeaveStatus.APPROVED) {
        await tx.shift.deleteMany({
          where: {
            userId: leaveRequest.userId,
            date: {
              gte: leaveRequest.startDate,
              lte: leaveRequest.endDate,
            },
          },
        });
      }

      return result;
    });

    return NextResponse.json({ leaveRequest: updated });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: err.issues },
        { status: 400 }
      );
    }
    console.error("Review leave request error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/hr/leave — Cancel own pending leave request
// ---------------------------------------------------------------------------
export async function DELETE(request: NextRequest) {
  const { user, error } = await requireRole(
    Role.SALES,
    Role.ADMIN,
    Role.SALES_MANAGER,
    Role.ADMIN_MANAGER,
    Role.SUPER_ADMIN
  );
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Leave request ID is required" },
        { status: 400 }
      );
    }

    const leaveRequest = await db.leaveRequest.findUnique({
      where: { id },
    });

    if (!leaveRequest) {
      return NextResponse.json(
        { error: "Leave request not found" },
        { status: 404 }
      );
    }

    // Only the owner can cancel their own pending request
    if (leaveRequest.userId !== user.userId) {
      return NextResponse.json(
        { error: "You can only cancel your own leave requests" },
        { status: 403 }
      );
    }

    if (leaveRequest.status !== LeaveStatus.PENDING) {
      return NextResponse.json(
        { error: "Only pending leave requests can be cancelled" },
        { status: 400 }
      );
    }

    const updated = await db.leaveRequest.update({
      where: { id },
      data: { status: LeaveStatus.CANCELLED },
      include: {
        user: { select: { id: true, name: true, role: true, division: true } },
      },
    });

    return NextResponse.json({ leaveRequest: updated });
  } catch (err) {
    console.error("Cancel leave request error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
