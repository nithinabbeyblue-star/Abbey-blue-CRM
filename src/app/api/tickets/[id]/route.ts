import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { Role } from "@/generated/prisma/enums";
import { sendPushToUser } from "@/lib/push";
import { triggerEvent, userChannel } from "@/lib/pusher";

const VALID_STATUSES = [
  "NEW",
  "CONTACTED",
  "DOCS_PENDING",
  "DOCS_RECEIVED",
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
  "ON_HOLD",
] as const;

const updateTicketSchema = z.object({
  status: z.enum(VALID_STATUSES).optional(),
  notes: z.string().optional(),
  priority: z.number().min(0).max(2).optional(),
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
  const { user, error } = await requireRole(Role.ADMIN, Role.KEY_COORDINATOR, Role.SUPER_ADMIN);
  if (error) return error;

  const { id } = await params;

  try {
    const body = await request.json();
    const data = updateTicketSchema.parse(body);

    const ticket = await db.ticket.findUnique({ where: { id } });
    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    // Admin can only update their own assigned tickets
    if (user.role === Role.ADMIN && ticket.assignedToId !== user.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Build update data and audit logs
    const updateData: Record<string, unknown> = {};
    const auditEntries: { action: string; oldValue: string | null; newValue: string | null }[] = [];

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
        newValue: data.notes.slice(0, 100), // truncate for log
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
