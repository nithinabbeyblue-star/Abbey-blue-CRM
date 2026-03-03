import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { Role } from "@/generated/prisma/enums";

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1, "Name is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["SUPER_ADMIN", "KEY_COORDINATOR", "SALES", "ADMIN"]),
});

// GET /api/users — List all users (Super Admin only)
export async function GET() {
  const { error } = await requireRole(Role.SUPER_ADMIN);
  if (error) return error;

  const users = await db.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
      _count: {
        select: {
          createdTickets: true,
          assignedTickets: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ users });
}

// POST /api/users — Create a new user (Super Admin only)
export async function POST(request: NextRequest) {
  const { error } = await requireRole(Role.SUPER_ADMIN);
  if (error) return error;

  try {
    const body = await request.json();
    const data = createUserSchema.parse(body);

    // Check if email already exists
    const existing = await db.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });
    if (existing) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    const user = await db.user.create({
      data: {
        email: data.email.toLowerCase(),
        name: data.name,
        passwordHash,
        role: data.role,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: err.issues },
        { status: 400 }
      );
    }
    console.error("Create user error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
