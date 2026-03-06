import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { Role } from "@/generated/prisma/enums";

// GET /api/users/sales — List all active Sales users (for SALES_MANAGER reassignment)
export async function GET() {
  const { error } = await requireRole(Role.SALES_MANAGER, Role.SUPER_ADMIN);
  if (error) return error;

  const salesUsers = await db.user.findMany({
    where: { role: Role.SALES, status: "ACTIVE" },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ salesUsers });
}
