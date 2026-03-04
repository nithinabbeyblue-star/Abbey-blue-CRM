import { NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { Role } from "@/generated/prisma/enums";
import { invalidateCache } from "@/lib/redis";

// POST /api/analytics/revenue/invalidate — Manual cache refresh (Super Admin only)
export async function POST() {
  const { error } = await requireRole(Role.SUPER_ADMIN);
  if (error) return error;

  await invalidateCache("analytics:revenue:*", "analytics:revenue:trends");

  return NextResponse.json({ success: true });
}
