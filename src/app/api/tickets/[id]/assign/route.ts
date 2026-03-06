import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { Role } from "@/generated/prisma/enums";
import { sendPushToUser } from "@/lib/push";
import { triggerEvent, userChannel } from "@/lib/pusher";

const assignSchema = z.object({
  assignedToId: z.string().min(1, "Admin user ID is required"),
});

// PATCH /api/tickets/[id]/assign — Assign ticket to an Admin member
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireRole(Role.ADMIN_MANAGER, Role.SUPER_ADMIN);
  if (error) return error;

  const { id } = await params;

  try {
    const body = await request.json();
    const { assignedToId } = assignSchema.parse(body);

    // Verify ticket exists
    const ticket = await db.ticket.findUnique({ where: { id } });
    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    // Verify the target user is an ADMIN
    const adminUser = await db.user.findUnique({
      where: { id: assignedToId },
      select: { id: true, role: true, name: true, status: true },
    });

    if (!adminUser || adminUser.role !== Role.ADMIN || adminUser.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Invalid admin user" },
        { status: 400 }
      );
    }

    const oldAssignee = ticket.assignedToId;

    // Update ticket
    const updated = await db.ticket.update({
      where: { id },
      data: { assignedToId },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        ticketId: id,
        userId: user.userId,
        action: "ASSIGNED",
        oldValue: oldAssignee || null,
        newValue: assignedToId,
        metadata: JSON.stringify({ assignedToName: adminUser.name }),
      },
    });

    // Add assigned Admin to the case ChatRoom (if exists)
    const chatRoom = await db.chatRoom.findUnique({
      where: { ticketId: id },
      select: { id: true },
    });

    if (chatRoom) {
      await db.chatRoomMember.upsert({
        where: {
          chatRoomId_userId: { chatRoomId: chatRoom.id, userId: assignedToId },
        },
        update: {}, // already a member — no-op
        create: {
          chatRoomId: chatRoom.id,
          userId: assignedToId,
        },
      });
    }

    // Notify assigned admin
    const notifTitle = "New Case Assignment";
    const notifBody = `You have been assigned case ${ticket.refNumber}`;
    const notifUrl = `/admin/tickets/${id}`;

    await db.notification.create({
      data: {
        type: "CASE_ASSIGNED",
        title: notifTitle,
        body: notifBody,
        userId: assignedToId,
        metadata: JSON.stringify({ ticketId: id }),
      },
    });

    // Push notification + real-time event
    sendPushToUser(assignedToId, { title: notifTitle, body: notifBody, url: notifUrl, tag: `assign-${id}` });
    triggerEvent(userChannel(assignedToId), "notification", {
      type: "CASE_ASSIGNED",
      title: notifTitle,
      body: notifBody,
      ticketId: id,
    });

    return NextResponse.json({ ticket: updated });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: err.issues },
        { status: 400 }
      );
    }
    console.error("Assign ticket error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
