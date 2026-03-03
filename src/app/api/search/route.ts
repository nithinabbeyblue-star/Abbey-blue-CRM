import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { Role } from "@/generated/prisma/enums";

// GET /api/search?q=... — Global permission-aware search
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();

  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  // Build role-based where clause
  const where: Record<string, unknown> = {
    OR: [
      { clientName: { contains: query, mode: "insensitive" } },
      { refNumber: { contains: query, mode: "insensitive" } },
      { clientPhone: { contains: query, mode: "insensitive" } },
      { clientEmail: { contains: query, mode: "insensitive" } },
    ],
  };

  // Data scoping by role
  if (user.role === Role.SALES) {
    where.createdById = user.userId;
  } else if (user.role === Role.ADMIN) {
    where.assignedToId = user.userId;
  }
  // KEY_COORDINATOR and SUPER_ADMIN see all

  const results = await db.ticket.findMany({
    where,
    take: 15,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      refNumber: true,
      clientName: true,
      clientPhone: true,
      status: true,
      createdAt: true,
      assignedTo: { select: { name: true } },
    },
  });

  return NextResponse.json({ results });
}
