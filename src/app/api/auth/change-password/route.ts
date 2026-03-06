import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { createAuditLog, extractIp, extractDevice } from "@/lib/audit";

const schema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

// POST /api/auth/change-password — Authenticated. Forces password change.
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { newPassword } = schema.parse(body);

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { passwordHash: true, mustSetPassword: true, status: true },
    });

    if (!user || user.status !== "ACTIVE") {
      return NextResponse.json({ error: "Account not active" }, { status: 403 });
    }

    if (!user.mustSetPassword) {
      return NextResponse.json({ error: "Password change not required" }, { status: 400 });
    }

    // Ensure new password differs from current
    if (user.passwordHash) {
      const same = await bcrypt.compare(newPassword, user.passwordHash);
      if (same) {
        return NextResponse.json({ error: "New password must be different from current password" }, { status: 400 });
      }
    }

    const hash = await bcrypt.hash(newPassword, 12);

    await db.user.update({
      where: { id: session.user.id },
      data: {
        passwordHash: hash,
        mustSetPassword: false,
        sessionVersion: { increment: 1 }, // Force re-login with clean JWT
      },
    });

    await createAuditLog({
      action: "PASSWORD_CHANGED",
      userId: session.user.id,
      ipAddress: extractIp(request.headers),
      userAgent: extractDevice(request.headers),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    }
    console.error("Change password error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
