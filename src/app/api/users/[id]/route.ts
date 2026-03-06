import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { Role } from "@/generated/prisma/enums";
import { encrypt } from "@/lib/encryption";
import { createAuditLog, extractIp, extractDevice } from "@/lib/audit";

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z.enum(["SUPER_ADMIN", "SALES_MANAGER", "ADMIN_MANAGER", "SALES", "ADMIN"]).optional(),
  password: z.string().min(6).optional(),
  employeeId: z.string().optional(),
  age: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  contactNumber: z.string().optional().nullable(),
  homeAddress: z.string().optional().nullable(),
  // Actions
  action: z.enum(["grant_access", "suspend", "reactivate"]).optional(),
});

// PATCH /api/users/[id] — Update user (Super Admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user: currentUser, error } = await requireRole(Role.SUPER_ADMIN);
  if (error) return error;

  const { id } = await params;
  const ip = extractIp(request.headers);
  const device = extractDevice(request.headers);

  try {
    const body = await request.json();
    const data = updateUserSchema.parse(body);

    const existingUser = await db.user.findUnique({ where: { id } });
    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Handle actions
    if (data.action === "grant_access") {
      if (existingUser.status !== "PENDING") {
        return NextResponse.json(
          { error: "Can only grant access to PENDING users" },
          { status: 400 }
        );
      }
      if (!existingUser.passwordHash) {
        return NextResponse.json(
          { error: "User has not set their password yet" },
          { status: 400 }
        );
      }

      const updated = await db.user.update({
        where: { id },
        data: {
          status: "ACTIVE",
          mustSetPassword: true, // Force password change after approval
        },
        select: {
          id: true, email: true, name: true, role: true, status: true,
          mustSetPassword: true, employeeId: true,
          lastLoginCity: true, lastLoginCountry: true, createdAt: true,
        },
      });

      await createAuditLog({
        action: "USER_ACCESS_GRANTED",
        userId: currentUser.userId,
        oldValue: "PENDING",
        newValue: "ACTIVE",
        metadata: JSON.stringify({ targetUserId: id, targetName: existingUser.name }),
        ipAddress: ip,
        userAgent: device,
      });

      return NextResponse.json({ user: updated });
    }

    if (data.action === "suspend") {
      if (id === currentUser.userId) {
        return NextResponse.json(
          { error: "You cannot deactivate your own account" },
          { status: 400 }
        );
      }

      // Kill switch: suspend + bump sessionVersion to invalidate all active sessions
      const updated = await db.user.update({
        where: { id },
        data: {
          status: "SUSPENDED",
          sessionVersion: { increment: 1 },
        },
        select: { id: true, email: true, name: true, role: true, status: true, employeeId: true, createdAt: true },
      });

      await createAuditLog({
        action: "USER_SUSPENDED",
        userId: currentUser.userId,
        oldValue: existingUser.status,
        newValue: "SUSPENDED",
        metadata: JSON.stringify({ targetUserId: id, targetName: existingUser.name }),
        ipAddress: ip,
        userAgent: device,
      });

      return NextResponse.json({ user: updated });
    }

    if (data.action === "reactivate") {
      if (existingUser.status !== "SUSPENDED") {
        return NextResponse.json(
          { error: "Can only reactivate SUSPENDED users" },
          { status: 400 }
        );
      }

      const updated = await db.user.update({
        where: { id },
        data: { status: "ACTIVE" },
        select: { id: true, email: true, name: true, role: true, status: true, employeeId: true, createdAt: true },
      });

      await createAuditLog({
        action: "USER_REACTIVATED",
        userId: currentUser.userId,
        oldValue: "SUSPENDED",
        newValue: "ACTIVE",
        metadata: JSON.stringify({ targetUserId: id, targetName: existingUser.name }),
        ipAddress: ip,
        userAgent: device,
      });

      return NextResponse.json({ user: updated });
    }

    // Standard field updates
    const updateData: Record<string, unknown> = {};

    if (data.name) updateData.name = data.name;
    if (data.email) updateData.email = data.email.toLowerCase();
    if (data.role) updateData.role = data.role;
    if (data.employeeId !== undefined) updateData.employeeId = data.employeeId || null;
    if (data.gender !== undefined) updateData.gender = data.gender;
    if (data.contactNumber !== undefined) updateData.contactNumber = data.contactNumber;
    if (data.password) {
      updateData.passwordHash = await bcrypt.hash(data.password, 12);
    }

    // Encrypt sensitive fields
    if (data.age !== undefined) {
      updateData.age = data.age ? encrypt(data.age) : null;
    }
    if (data.homeAddress !== undefined) {
      updateData.homeAddress = data.homeAddress ? encrypt(data.homeAddress) : null;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ user: existingUser });
    }

    const updated = await db.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        employeeId: true,
        createdAt: true,
      },
    });

    await createAuditLog({
      action: "USER_UPDATED",
      userId: currentUser.userId,
      newValue: Object.keys(updateData).join(", "),
      metadata: JSON.stringify({ targetUserId: id, targetName: existingUser.name }),
      ipAddress: ip,
      userAgent: device,
    });

    return NextResponse.json({ user: updated });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: err.issues },
        { status: 400 }
      );
    }
    console.error("Update user error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
