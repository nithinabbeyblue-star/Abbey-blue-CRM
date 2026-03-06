import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { Role } from "@/generated/prisma/enums";
import { createAuditLog, extractIp, extractDevice } from "@/lib/audit";
import { triggerEvent, userChannel } from "@/lib/pusher";

// GET /api/governance/stagnant — List tickets not updated in 5+ days
export async function GET() {
  const { error } = await requireRole(Role.SUPER_ADMIN);
  if (error) return error;

  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

  const stagnant = await db.ticket.findMany({
    where: {
      updatedAt: { lt: fiveDaysAgo },
      status: { notIn: ["APPROVED", "REJECTED"] },
    },
    select: {
      id: true,
      refNumber: true,
      clientName: true,
      status: true,
      updatedAt: true,
      assignedTo: { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
    },
    orderBy: { updatedAt: "asc" },
  });

  return NextResponse.json({ tickets: stagnant });
}

const nudgeSchema = z.object({
  ticketId: z.string().min(1),
  assignedToId: z.string().min(1),
});

// POST /api/governance/stagnant — Send nudge notification
export async function POST(request: NextRequest) {
  const { user, error } = await requireRole(Role.SUPER_ADMIN);
  if (error) return error;

  try {
    const body = await request.json();
    const { ticketId, assignedToId } = nudgeSchema.parse(body);

    const ticket = await db.ticket.findUnique({
      where: { id: ticketId },
      select: { refNumber: true },
    });

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    // Create notification for the assigned user
    await db.notification.create({
      data: {
        type: "CASE_ASSIGNED",
        title: "Stagnant Case Reminder",
        body: `Ticket ${ticket.refNumber} has not been updated for over 5 days. Please review and take action.`,
        userId: assignedToId,
      },
    });

    // Push real-time notification
    await triggerEvent(userChannel(assignedToId), "notification", {
      title: "Stagnant Case Reminder",
      body: `Ticket ${ticket.refNumber} needs attention.`,
    });

    // Audit log
    await createAuditLog({
      action: "STAGNATION_NUDGE",
      userId: user.userId,
      ticketId,
      metadata: JSON.stringify({ assignedToId }),
      ipAddress: extractIp(request.headers),
      userAgent: extractDevice(request.headers),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    console.error("Nudge error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
