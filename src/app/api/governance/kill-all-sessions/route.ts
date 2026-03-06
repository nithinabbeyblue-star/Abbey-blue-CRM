import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { Role } from "@/generated/prisma/enums";
import { createAuditLog, extractIp, extractDevice } from "@/lib/audit";

// POST /api/governance/kill-all-sessions — Kill all non-SA sessions
export async function POST(request: NextRequest) {
  const { user, error } = await requireRole(Role.SUPER_ADMIN);
  if (error) return error;

  try {
    const result = await db.user.updateMany({
      where: {
        role: { not: "SUPER_ADMIN" },
        status: "ACTIVE",
      },
      data: {
        sessionVersion: { increment: 1 },
      },
    });

    await createAuditLog({
      action: "GLOBAL_SESSION_KILL",
      userId: user.userId,
      metadata: JSON.stringify({ affectedUsers: result.count }),
      ipAddress: extractIp(request.headers),
      userAgent: extractDevice(request.headers),
    });

    return NextResponse.json({ count: result.count });
  } catch (err) {
    console.error("Kill all sessions error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
