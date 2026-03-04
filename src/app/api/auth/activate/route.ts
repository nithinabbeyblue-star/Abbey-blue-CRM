import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { createAuditLog, extractIp, extractDevice } from "@/lib/audit";

const activateSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

// POST /api/auth/activate — First-time password set for PENDING users
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = activateSchema.parse(body);

    const user = await db.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    if (user.status !== "PENDING") {
      return NextResponse.json(
        { error: "Account is not pending activation" },
        { status: 400 }
      );
    }

    if (!user.mustSetPassword) {
      return NextResponse.json(
        { error: "Password has already been set. Please wait for admin approval." },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    await db.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        mustSetPassword: false,
      },
    });

    // Audit log
    const ip = extractIp(request.headers);
    const device = extractDevice(request.headers);

    await createAuditLog({
      action: "USER_ACTIVATED_PASSWORD",
      userId: user.id,
      newValue: "Password set by user",
      ipAddress: ip,
      userAgent: device,
    });

    return NextResponse.json({
      message: "Password set successfully. Your account is pending admin approval.",
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: err.issues },
        { status: 400 }
      );
    }
    console.error("Activate error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
