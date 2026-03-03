import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { generateRefNumber } from "@/lib/ticket-utils";
import { notifyKeyCoordinator } from "@/lib/mail";
import { Role, CaseType } from "@/generated/prisma/enums";
import type { CaseTypeKey } from "@/constants/cases";

const createTicketSchema = z.object({
  clientName: z.string().min(1, "Client name is required"),
  clientEmail: z.string().email().optional().or(z.literal("")),
  clientPhone: z.string().min(1, "Phone number is required"),
  nationality: z.string().optional().or(z.literal("")),
  caseType: z.nativeEnum(CaseType).optional().nullable(),
  destination: z.string().optional().or(z.literal("")),
  source: z.enum([
    "WHATSAPP",
    "TIKTOK",
    "WALK_IN",
    "REFERRAL",
    "WEBSITE",
    "WEBHOOK",
  ]),
  priority: z.number().min(0).max(2).optional(),
  notes: z.string().optional().or(z.literal("")),
});

// POST /api/tickets — Create a new ticket (Sales only)
export async function POST(request: NextRequest) {
  const { user, error } = await requireRole(Role.SALES, Role.SUPER_ADMIN);
  if (error) return error;

  try {
    const body = await request.json();
    const data = createTicketSchema.parse(body);
    const refNumber = await generateRefNumber((data.caseType as CaseTypeKey) ?? null);

    const ticket = await db.ticket.create({
      data: {
        refNumber,
        clientName: data.clientName,
        clientEmail: data.clientEmail || null,
        clientPhone: data.clientPhone,
        nationality: data.nationality || null,
        caseType: data.caseType || null,
        destination: data.destination || null,
        source: data.source,
        priority: data.priority ?? 0,
        notes: data.notes || null,
        createdById: user.userId,
      },
    });

    // Create audit log entry
    await db.auditLog.create({
      data: {
        ticketId: ticket.id,
        userId: user.userId,
        action: "TICKET_CREATED",
        newValue: "LEAD",
        metadata: JSON.stringify({ source: data.source, caseType: data.caseType }),
      },
    });

    // Auto-create ChatRoom for this case
    // Members: the sales person + all Key Coordinators + all Super Admins
    const coordinatorsAndAdmins = await db.user.findMany({
      where: {
        isActive: true,
        role: { in: [Role.KEY_COORDINATOR, Role.SUPER_ADMIN] },
      },
      select: { id: true },
    });

    const memberIds = new Set([
      user.userId, // The sales person who created the ticket
      ...coordinatorsAndAdmins.map((u) => u.id),
    ]);

    await db.chatRoom.create({
      data: {
        ticketId: ticket.id,
        members: {
          create: Array.from(memberIds).map((userId) => ({ userId })),
        },
      },
    });

    // Notify Key Coordinator via email
    notifyKeyCoordinator({
      refNumber: ticket.refNumber,
      clientName: ticket.clientName,
      clientPhone: ticket.clientPhone,
      caseType: ticket.caseType,
      destination: ticket.destination,
      source: ticket.source,
      createdByName: user.name,
    }).catch((err) => {
      console.error("Failed to send notification email:", err);
    });

    return NextResponse.json({ ticket }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: err.issues },
        { status: 400 }
      );
    }
    console.error("Create ticket error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/tickets — List tickets (scoped by role)
export async function GET(request: NextRequest) {
  const { user, error } = await requireRole(
    Role.SALES,
    Role.ADMIN,
    Role.KEY_COORDINATOR,
    Role.SUPER_ADMIN
  );
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "20", 10);
  const skip = (page - 1) * limit;

  // Build where clause based on role (data scoping)
  const where: Record<string, unknown> = {};

  if (user.role === Role.SALES) {
    where.createdById = user.userId; // Sales sees only their own tickets
  } else if (user.role === Role.ADMIN) {
    where.assignedToId = user.userId; // Admin sees only assigned tickets
  }
  // KEY_COORDINATOR and SUPER_ADMIN see all tickets

  if (status) {
    where.status = status;
  }

  const [tickets, total] = await Promise.all([
    db.ticket.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        createdBy: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    }),
    db.ticket.count({ where }),
  ]);

  return NextResponse.json({
    tickets,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
