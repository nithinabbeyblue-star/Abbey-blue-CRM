import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { Role, CaseType } from "@/generated/prisma/enums";
import { sendPushToUser } from "@/lib/push";
import { triggerEvent, userChannel } from "@/lib/pusher";
import { invalidateCache } from "@/lib/redis";

const VALID_STATUSES = [
  "LEAD",
  "DOC_COLLECTION",
  "SUBMITTED",
  "IN_PROGRESS",
  "APPROVED",
  "REJECTED",
  "ON_HOLD",
] as const;

const VALID_SOURCES = [
  "WHATSAPP", "TIKTOK", "WALK_IN", "REFERRAL", "WEBSITE", "WEBHOOK",
] as const;

const updateTicketSchema = z.object({
  status: z.enum(VALID_STATUSES).optional(),
  notes: z.string().optional(),
  priority: z.number().min(0).max(2).optional(),
  // Client & case detail fields
  clientName: z.string().min(1).optional(),
  clientEmail: z.string().email().optional().or(z.literal("")).nullable(),
  clientPhone: z.string().min(1).optional(),
  nationality: z.string().optional().nullable(),
  caseType: z.nativeEnum(CaseType).optional().nullable(),
  destination: z.string().optional().nullable(),
  source: z.enum(VALID_SOURCES).optional(),
  // Financial fields
  ablFee: z.number().min(0).nullable().optional(),
  govFee: z.number().min(0).nullable().optional(),
  adverts: z.number().min(0).nullable().optional(),
  paidAmount: z.number().min(0).optional(),
  caseDeadline: z.string().nullable().optional(),
});

// GET /api/tickets/[id] — Get a single ticket
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireRole(
    Role.SALES,
    Role.ADMIN,
    Role.KEY_COORDINATOR,
    Role.SUPER_ADMIN
  );
  if (error) return error;

  const { id } = await params;

  const ticket = await db.ticket.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
      financesUpdatedBy: { select: { name: true } },
      auditLogs: {
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  // Enforce data scoping
  if (user.role === Role.SALES && ticket.createdById !== user.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (user.role === Role.ADMIN && ticket.assignedToId !== user.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ ticket });
}

// PATCH /api/tickets/[id] — Update ticket status/notes (Admin, Super Admin)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireRole(Role.SALES, Role.ADMIN, Role.KEY_COORDINATOR, Role.SUPER_ADMIN);
  if (error) return error;

  const { id } = await params;

  try {
    const body = await request.json();
    const data = updateTicketSchema.parse(body);

    const ticket = await db.ticket.findUnique({ where: { id } });
    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    // Scoping: Admin can only update their assigned tickets
    if (user.role === Role.ADMIN && ticket.assignedToId !== user.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Scoping: Sales can only update their own tickets
    if (user.role === Role.SALES && ticket.createdById !== user.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // RBAC: Sales cannot update status/notes/priority
    if (user.role === Role.SALES) {
      if (data.status || data.notes !== undefined || data.priority !== undefined) {
        return NextResponse.json({ error: "Sales cannot update case status or notes" }, { status: 403 });
      }
    }

    // RBAC: Financial field restrictions
    const isFeeUpdate = data.ablFee !== undefined || data.govFee !== undefined || data.adverts !== undefined;
    if (isFeeUpdate) {
      if (user.role === Role.SALES && ticket.status !== "LEAD") {
        return NextResponse.json({ error: "Sales can only update fees for Lead tickets" }, { status: 403 });
      }
      if (user.role === Role.ADMIN) {
        return NextResponse.json({ error: "Admin cannot update fee fields" }, { status: 403 });
      }
    }
    if (data.paidAmount !== undefined && user.role === Role.SALES) {
      return NextResponse.json({ error: "Sales cannot update paid amount" }, { status: 403 });
    }
    if (data.caseDeadline !== undefined && user.role === Role.SALES) {
      return NextResponse.json({ error: "Sales cannot update deadline" }, { status: 403 });
    }

    // Build update data and audit logs
    const updateData: Record<string, unknown> = {};
    const auditEntries: { action: string; oldValue: string | null; newValue: string | null; metadata?: string }[] = [];

    if (data.status && data.status !== ticket.status) {
      auditEntries.push({
        action: "STATUS_CHANGE",
        oldValue: ticket.status,
        newValue: data.status,
      });
      updateData.status = data.status;
    }

    if (data.notes !== undefined && data.notes !== ticket.notes) {
      auditEntries.push({
        action: "NOTES_UPDATED",
        oldValue: null,
        newValue: data.notes.slice(0, 100),
      });
      updateData.notes = data.notes;
    }

    if (data.priority !== undefined && data.priority !== ticket.priority) {
      auditEntries.push({
        action: "PRIORITY_CHANGE",
        oldValue: String(ticket.priority),
        newValue: String(data.priority),
      });
      updateData.priority = data.priority;
    }

    // Client & case detail fields
    const detailFields = ["clientName", "clientPhone", "clientEmail", "nationality", "caseType", "destination", "source"] as const;
    for (const field of detailFields) {
      if (data[field] !== undefined) {
        const oldVal = ticket[field];
        const newVal = data[field];
        if (String(newVal ?? "") !== String(oldVal ?? "")) {
          auditEntries.push({
            action: "DETAILS_UPDATED",
            oldValue: String(oldVal ?? ""),
            newValue: String(newVal ?? ""),
            metadata: JSON.stringify({ field }),
          });
          updateData[field] = newVal === "" ? null : newVal;
        }
      }
    }

    // Financial fields
    let hasFinancialChange = false;
    const finFields = ["ablFee", "govFee", "adverts", "paidAmount"] as const;
    for (const field of finFields) {
      if (data[field] !== undefined && data[field] !== ticket[field]) {
        auditEntries.push({
          action: "FINANCE_UPDATED",
          oldValue: String(ticket[field] ?? "unset"),
          newValue: String(data[field] ?? "unset"),
          metadata: JSON.stringify({ field }),
        });
        updateData[field] = data[field];
        hasFinancialChange = true;
      }
    }

    if (data.caseDeadline !== undefined) {
      const newDeadline = data.caseDeadline ? new Date(data.caseDeadline) : null;
      updateData.caseDeadline = newDeadline;
      auditEntries.push({
        action: "DEADLINE_UPDATED",
        oldValue: ticket.caseDeadline?.toISOString() ?? null,
        newValue: data.caseDeadline ?? null,
      });
    }

    if (hasFinancialChange) {
      updateData.financesUpdatedById = user.userId;
      updateData.financesUpdatedAt = new Date();

      // Invalidate revenue/overview caches and notify finance dashboard
      await invalidateCache("analytics:revenue:*", "analytics:revenue:trends", "analytics:overview");
      triggerEvent("finance-dashboard", "finance-updated", { ticketId: id });
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ ticket });
    }

    const updated = await db.ticket.update({
      where: { id },
      data: updateData,
    });

    // Write audit logs
    await db.auditLog.createMany({
      data: auditEntries.map((entry) => ({
        ticketId: id,
        userId: user.userId,
        ...entry,
      })),
    });

    // Notify relevant users about status changes
    if (data.status && data.status !== ticket.status) {
      const statusLabel = data.status.replace(/_/g, " ");
      const notifTitle = "Case Status Updated";
      const notifBody = `Case ${ticket.refNumber} status changed to ${statusLabel}`;

      // Notify: sales creator, assigned admin (skip the user who made the change)
      const notifyUserIds = [ticket.createdById, ticket.assignedToId]
        .filter((uid): uid is string => !!uid && uid !== user.userId);

      for (const uid of notifyUserIds) {
        const ticketPath = uid === ticket.createdById
          ? `/sales/tickets/${id}`
          : `/admin/tickets/${id}`;

        await db.notification.create({
          data: {
            type: "STATUS_CHANGE",
            title: notifTitle,
            body: notifBody,
            userId: uid,
            metadata: JSON.stringify({ ticketId: id, status: data.status }),
          },
        });

        sendPushToUser(uid, { title: notifTitle, body: notifBody, url: ticketPath, tag: `status-${id}` });
        triggerEvent(userChannel(uid), "notification", {
          type: "STATUS_CHANGE",
          title: notifTitle,
          body: notifBody,
          ticketId: id,
        });
      }
    }

    return NextResponse.json({ ticket: updated });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: err.issues },
        { status: 400 }
      );
    }
    console.error("Update ticket error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/tickets/[id] — Delete ticket (Super Admin + Key Coordinator only)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireRole(Role.KEY_COORDINATOR, Role.SUPER_ADMIN);
  if (error) return error;

  const { id } = await params;

  const ticket = await db.ticket.findUnique({ where: { id } });
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  // All related records cascade-delete via onDelete: Cascade in schema
  await db.ticket.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
