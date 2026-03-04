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

const updatePaymentSchema = z.object({
  paymentId: z.string().min(1),
  amount: z.number().positive().optional(),
  type: z.enum(["CONSULTATION_FEE", "SERVICE_FEE", "GOVERNMENT_FEE", "OTHER"]).optional(),
  status: z.enum(["PENDING", "PAID", "REFUNDED"]).optional(),
  notes: z.string().optional(),
  paidAt: z.string().nullable().optional(),
});

const deletePaymentSchema = z.object({
  paymentId: z.string().min(1),
});

// POST /api/tickets/[id]/payments — Record a payment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireRole(Role.ADMIN, Role.KEY_COORDINATOR, Role.SUPER_ADMIN);
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
  const { error } = await requireRole(Role.SALES, Role.ADMIN, Role.KEY_COORDINATOR, Role.SUPER_ADMIN);
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

// PATCH /api/tickets/[id]/payments — Update a payment
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireRole(Role.ADMIN, Role.KEY_COORDINATOR, Role.SUPER_ADMIN);
  if (error) return error;

  const { id } = await params;

  try {
    const body = await request.json();
    const { paymentId, ...updates } = updatePaymentSchema.parse(body);

    const existing = await db.payment.findFirst({
      where: { id: paymentId, ticketId: id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    // Build update data
    const data: Record<string, unknown> = {};
    if (updates.amount !== undefined) data.amount = updates.amount;
    if (updates.type !== undefined) data.type = updates.type;
    if (updates.status !== undefined) {
      data.status = updates.status;
      // Auto-set paidAt when marking as PAID
      if (updates.status === "PAID" && !existing.paidAt && updates.paidAt === undefined) {
        data.paidAt = new Date();
      }
    }
    if (updates.notes !== undefined) data.notes = updates.notes || null;
    if (updates.paidAt !== undefined) data.paidAt = updates.paidAt ? new Date(updates.paidAt) : null;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const payment = await db.payment.update({
      where: { id: paymentId },
      data,
    });

    // Audit log
    const changes: string[] = [];
    if (updates.amount !== undefined) changes.push(`amount: ${existing.amount} → ${updates.amount}`);
    if (updates.type !== undefined) changes.push(`type: ${existing.type} → ${updates.type}`);
    if (updates.status !== undefined) changes.push(`status: ${existing.status} → ${updates.status}`);

    await db.auditLog.create({
      data: {
        ticketId: id,
        userId: user.userId,
        action: "PAYMENT_UPDATED",
        oldValue: `${existing.currency} ${existing.amount} (${existing.type})`,
        newValue: `${payment.currency} ${payment.amount} (${payment.type})`,
        metadata: JSON.stringify({ paymentId, changes }),
      },
    });

    await invalidateCache("analytics:revenue:*", "analytics:revenue:trends", "analytics:overview");
    triggerEvent("finance-dashboard", "finance-updated", { ticketId: id });

    return NextResponse.json({ payment });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: err.issues },
        { status: 400 }
      );
    }
    console.error("Update payment error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/tickets/[id]/payments — Delete a payment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireRole(Role.ADMIN, Role.KEY_COORDINATOR, Role.SUPER_ADMIN);
  if (error) return error;

  const { id } = await params;

  try {
    const body = await request.json();
    const { paymentId } = deletePaymentSchema.parse(body);

    const existing = await db.payment.findFirst({
      where: { id: paymentId, ticketId: id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    // Audit log before delete
    await db.auditLog.create({
      data: {
        ticketId: id,
        userId: user.userId,
        action: "PAYMENT_DELETED",
        oldValue: `${existing.currency} ${existing.amount} (${existing.type})`,
        metadata: JSON.stringify({
          paymentId,
          amount: existing.amount,
          type: existing.type,
          status: existing.status,
        }),
      },
    });

    await db.payment.delete({ where: { id: paymentId } });

    await invalidateCache("analytics:revenue:*", "analytics:revenue:trends", "analytics:overview");
    triggerEvent("finance-dashboard", "finance-updated", { ticketId: id });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: err.issues },
        { status: 400 }
      );
    }
    console.error("Delete payment error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
