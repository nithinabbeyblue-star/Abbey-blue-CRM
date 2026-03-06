import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { Role } from "@/generated/prisma/enums";
import bcrypt from "bcryptjs";
import { encrypt, decrypt } from "@/lib/encryption";
import { createAuditLog, extractIp, extractDevice } from "@/lib/audit";
import { sendMail } from "@/lib/mail";

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1, "Name is required"),
  role: z.enum(["SUPER_ADMIN", "KEY_COORDINATOR", "SALES", "ADMIN"]),
  employeeId: z.string().min(1, "Employee ID is required"),
  age: z.string().optional(),
  gender: z.string().optional(),
  contactNumber: z.string().optional(),
  homeAddress: z.string().optional(),
  tempPassword: z.string().min(8).optional(),
});

// GET /api/users — List all users (Super Admin only)
export async function GET() {
  try {
    const { error } = await requireRole(Role.SUPER_ADMIN);
    if (error) return error;

    const users = await db.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        mustSetPassword: true,
        employeeId: true,
        age: true,
        gender: true,
        contactNumber: true,
        homeAddress: true,
        lastLoginCity: true,
        lastLoginCountry: true,
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

    // Decrypt sensitive fields
    const decrypted = users.map((u) => ({
      ...u,
      age: u.age ? decrypt(u.age) : null,
      homeAddress: u.homeAddress ? decrypt(u.homeAddress) : null,
    }));

    return NextResponse.json({ users: decrypted });
  } catch (err) {
    console.error("GET /api/users error:", err);
    return NextResponse.json(
      { users: [], error: "Failed to load users" },
      { status: 500 }
    );
  }
}

// POST /api/users — Create a new user (Super Admin only, no password — PENDING status)
export async function POST(request: NextRequest) {
  const { user: currentUser, error } = await requireRole(Role.SUPER_ADMIN);
  if (error) return error;

  try {
    const body = await request.json();
    const data = createUserSchema.parse(body);

    const existing = await db.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });
    if (existing) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 409 }
      );
    }

    if (data.employeeId) {
      const existingEmp = await db.user.findUnique({
        where: { employeeId: data.employeeId },
      });
      if (existingEmp) {
        return NextResponse.json(
          { error: "This Employee ID is already in use" },
          { status: 409 }
        );
      }
    }

    // If tempPassword provided, hash it so user can log in immediately
    const passwordHash = data.tempPassword
      ? await bcrypt.hash(data.tempPassword, 12)
      : null;

    const user = await db.user.create({
      data: {
        email: data.email.toLowerCase(),
        name: data.name,
        role: data.role,
        status: "PENDING",
        mustSetPassword: !data.tempPassword, // false if temp password set (they'll change it after approval)
        passwordHash,
        employeeId: data.employeeId,
        age: data.age ? encrypt(data.age) : null,
        gender: data.gender || null,
        contactNumber: data.contactNumber || null,
        homeAddress: data.homeAddress ? encrypt(data.homeAddress) : null,
      },
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

    const ip = extractIp(request.headers);
    const device = extractDevice(request.headers);
    await createAuditLog({
      action: "USER_CREATED",
      userId: currentUser.userId,
      newValue: `${user.name} (${user.email}) — ${user.role}`,
      metadata: JSON.stringify({ createdUserId: user.id }),
      ipAddress: ip,
      userAgent: device,
    });

    // Send email with credentials to SA
    if (data.tempPassword) {
      const saEmail = process.env.SUPER_ADMIN_EMAIL;
      if (saEmail) {
        await sendMail({
          to: saEmail,
          subject: `New User Created: ${user.name} (${user.role})`,
          html: `
            <h2>New User Account Created</h2>
            <table style="border-collapse:collapse;">
              <tr><td style="padding:4px 12px;font-weight:bold;">Name</td><td>${user.name}</td></tr>
              <tr><td style="padding:4px 12px;font-weight:bold;">Email</td><td>${user.email}</td></tr>
              <tr><td style="padding:4px 12px;font-weight:bold;">Role</td><td>${user.role}</td></tr>
              <tr><td style="padding:4px 12px;font-weight:bold;">Temp Password</td><td>${data.tempPassword}</td></tr>
            </table>
            <p style="margin-top:16px;">Share these credentials securely with the user.</p>
          `,
        });
      }

      // Console log mock email for the user
      console.log(`\n[Mock Email to ${user.email}]`);
      console.log(`Subject: Your Abbey CRM Account`);
      console.log(`Email: ${user.email}`);
      console.log(`Temporary Password: ${data.tempPassword}`);
      console.log(`Please log in and wait for admin approval.\n`);
    }

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
