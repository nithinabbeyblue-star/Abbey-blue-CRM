import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { Role } from "@/generated/prisma/enums";

const duplicateSchema = z.object({
  phone: z.string().optional(),
  email: z.string().optional(),
});

// POST /api/governance/duplicates — Check for duplicate clients
export async function POST(request: NextRequest) {
  const { error } = await requireRole(Role.SALES, Role.SUPER_ADMIN);
  if (error) return error;

  try {
    const body = await request.json();
    const { phone, email } = duplicateSchema.parse(body);

    const conditions = [];
    if (phone && phone.trim().length >= 6) {
      conditions.push({ clientPhone: phone.trim() });
    }
    if (email && email.trim().includes("@")) {
      conditions.push({ clientEmail: { equals: email.trim(), mode: "insensitive" as const } });
    }

    if (conditions.length === 0) {
      return NextResponse.json({ matches: [] });
    }

    const matches = await db.ticket.findMany({
      where: { OR: conditions },
      select: {
        id: true,
        refNumber: true,
        clientName: true,
        clientPhone: true,
        clientEmail: true,
        status: true,
        createdAt: true,
      },
      take: 10,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ matches });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    console.error("Duplicate check error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
