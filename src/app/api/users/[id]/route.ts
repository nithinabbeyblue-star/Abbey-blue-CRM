import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { Role } from "@/generated/prisma/enums";

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z.enum(["SUPER_ADMIN", "KEY_COORDINATOR", "SALES", "ADMIN"]).optional(),
  password: z.string().min(6).optional(),
  isActive: z.boolean().optional(),
});

// PATCH /api/users/[id] — Update user (Super Admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user: currentUser, error } = await requireRole(Role.SUPER_ADMIN);
  if (error) return error;

  const { id } = await params;

  try {
    const body = await request.json();
    const data = updateUserSchema.parse(body);

    const existingUser = await db.user.findUnique({ where: { id } });
    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Prevent deactivating yourself
    if (data.isActive === false && id === currentUser.userId) {
      return NextResponse.json(
        { error: "You cannot deactivate your own account" },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (data.name) updateData.name = data.name;
    if (data.email) updateData.email = data.email.toLowerCase();
    if (data.role) updateData.role = data.role;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.password) {
      updateData.passwordHash = await bcrypt.hash(data.password, 12);
    }

    const updated = await db.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
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
