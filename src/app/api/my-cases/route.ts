import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { Role } from "@/generated/prisma/enums";

// GET /api/my-cases — Get cases for current user with sorting
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const sort = searchParams.get("sort") || "recent"; // "recent" | "alpha" | "status"
  const status = searchParams.get("status") || "";

  // Build where clause based on role
  let where: Record<string, unknown> = {};
  if (user.role === Role.SALES) {
    where = { createdById: user.userId };
  } else if (user.role === Role.ADMIN) {
    where = { assignedToId: user.userId };
  }
  // KC and SA see all

  if (status) {
    where.status = status;
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
    default: // "recent"
      orderBy = { updatedAt: "desc" };
  }

  const tickets = await db.ticket.findMany({
    where,
    orderBy,
    include: {
      createdBy: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
    },
  });

  // Status counts for filter tabs
  const statusCounts = await db.ticket.groupBy({
    by: ["status"],
    where: user.role === Role.SALES
      ? { createdById: user.userId }
      : user.role === Role.ADMIN
      ? { assignedToId: user.userId }
      : {},
    _count: true,
  });

  return NextResponse.json({
    tickets,
    statusCounts: statusCounts.map((s) => ({ status: s.status, count: s._count })),
    total: tickets.length,
  });
}
