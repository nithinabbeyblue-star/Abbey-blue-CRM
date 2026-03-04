import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { Role } from "@/generated/prisma/enums";
import { invalidateCache } from "@/lib/redis";
import { triggerEvent } from "@/lib/pusher";

const createPaymentSchema = z.object({
  amount: z.number().positive("Amount must be positive"),
  currency: z.string().default("GBP"),
  type: z.enum(["CONSULTATION_FEE", "SERVICE_FEE", "GOVERNMENT_FEE", "OTHER"]),
  status: z.enum(["PENDING", "PAID", "REFUNDED"]).default("PENDING"),
  notes: z.string().optional(),
  paidAt: z.string().optional(), // ISO date string
});

// POST /api/tickets/[id]/payments — Record a payment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireRole(Role.ADMIN, Role.SUPER_ADMIN);
  if (error) return error;

  const { id } = await params;

  try {
    const ticket = await db.ticket.findUnique({ where: { id } });
    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const body = await request.json();
    const data = createPaymentSchema.parse(body);

    const payment = await db.payment.create({
      data: {
        ticketId: id,
        recordedById: user.userId,
        amount: data.amount,
        currency: data.currency,
        type: data.type,
        status: data.status,
        notes: data.notes || null,
        paidAt: data.paidAt ? new Date(data.paidAt) : data.status === "PAID" ? new Date() : null,
      },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        ticketId: id,
        userId: user.userId,
        action: "PAYMENT_RECORDED",
        newValue: `${data.currency} ${data.amount} (${data.type})`,
        metadata: JSON.stringify({ paymentId: payment.id, status: data.status }),
      },
    });

    // Invalidate revenue/overview caches and notify finance dashboard
    await invalidateCache("analytics:revenue:*", "analytics:revenue:trends", "analytics:overview");
    triggerEvent("finance-dashboard", "finance-updated", { ticketId: id });

    return NextResponse.json({ payment }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: err.issues },
        { status: 400 }
      );
    }
    console.error("Create payment error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/tickets/[id]/payments — List payments for a ticket
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireRole(Role.ADMIN, Role.SUPER_ADMIN);
  if (error) return error;

  const { id } = await params;

  const payments = await db.payment.findMany({
    where: { ticketId: id },
    orderBy: { createdAt: "desc" },
    include: {
      recordedBy: { select: { name: true } },
    },
  });

  return NextResponse.json({ payments });
}
