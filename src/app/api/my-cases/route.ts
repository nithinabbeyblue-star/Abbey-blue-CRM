import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET /api/my-cases — Get cases personally assigned to OR created by the current user
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const sort = searchParams.get("sort") || "recent";
  const status = searchParams.get("status") || "";
  const caseType = searchParams.get("caseType") || "";
  const priority = searchParams.get("priority");

  // Always personal: cases where user is the assignee OR the creator
  const where: Record<string, unknown> = {
    OR: [
      { assignedToId: user.userId },
      { createdById: user.userId },
    ],
  };

  if (status) {
    where.status = status;
  } else {
    // By default, exclude APPROVED/REJECTED from active view
    where.status = { notIn: ["APPROVED", "REJECTED"] };
  }

  if (caseType) {
    where.caseType = caseType;
  }

  if (priority) {
    where.priority = parseInt(priority, 10);
  }

  // Build orderBy based on sort
  let orderBy: Record<string, string>;
  switch (sort) {
    case "alpha":
      orderBy = { clientName: "asc" };
      break;
    case "status":
      orderBy = { status: "asc" };
      break;
    case "oldest":
      orderBy = { createdAt: "asc" };
      break;
    default:
      orderBy = { updatedAt: "desc" };
  }

  const tickets = await db.ticket.findMany({
    where,
    orderBy,
    select: {
      id: true,
      refNumber: true,
      clientName: true,
      clientPhone: true,
      clientEmail: true,
      caseType: true,
      status: true,
      source: true,
      priority: true,
      createdAt: true,
      updatedAt: true,
      createdBy: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
    },
  });

  // Status counts scoped to personal cases
  const statusCounts = await db.ticket.groupBy({
    by: ["status"],
    where: {
      OR: [
        { assignedToId: user.userId },
        { createdById: user.userId },
      ],
    },
    _count: true,
  });

  return NextResponse.json({
    tickets,
    statusCounts: statusCounts.map((s) => ({ status: s.status, count: s._count })),
    total: tickets.length,
  });
}
