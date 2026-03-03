import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { Role } from "@/generated/prisma/enums";

// GET /api/users/admins — List all active Admin users (for assignment dropdown)
export async function GET() {
  const { error } = await requireRole(
    Role.ADMIN,
    Role.KEY_COORDINATOR,
    Role.SUPER_ADMIN
  );
  if (error) return error;

  const admins = await db.user.findMany({
    where: { role: Role.ADMIN, isActive: true },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ admins });
}
