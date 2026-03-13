import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { Role } from "@/generated/prisma/enums";
import { sendMail } from "@/lib/mail";
import { calculateDeadline, generateReminderEmail } from "@/lib/deadlines";

const ALL_ROLES = [
  Role.SUPER_ADMIN,
  Role.SALES_MANAGER,
  Role.ADMIN_MANAGER,
  Role.SALES,
  Role.ADMIN,
] as const;

export async function POST(req: NextRequest) {
  const { user, error } = await requireRole(...ALL_ROLES);
  if (error) return error;

  const body = await req.json();
  const { ticketId } = body;

  if (!ticketId) {
    return NextResponse.json({ error: "ticketId required" }, { status: 400 });
  }

  const ticket = await db.ticket.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
      refNumber: true,
      clientName: true,
      clientEmail: true,
      caseType: true,
      caseDeadline: true,
      caseEndDate: true,
      adsFinishingDate: true,
      visaExpiryDate: true,
      createdById: true,
      assignedToId: true,
    },
  });

  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  // Check permission: owner, assigned user, or manager/admin
  const canSend =
    ticket.createdById === user.userId ||
    ticket.assignedToId === user.userId ||
    ["SUPER_ADMIN", "SALES_MANAGER", "ADMIN_MANAGER"].includes(user.role);

  if (!canSend) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  if (!ticket.clientEmail) {
    return NextResponse.json({ error: "Client has no email address" }, { status: 400 });
  }

  const deadlineDate = ticket.visaExpiryDate || ticket.caseDeadline || ticket.caseEndDate || ticket.adsFinishingDate;
  const deadlineInfo = calculateDeadline(deadlineDate);

  if (!deadlineInfo) {
    return NextResponse.json({ error: "No deadline set for this case" }, { status: 400 });
  }

  const { subject, html } = generateReminderEmail({
    clientName: ticket.clientName,
    clientEmail: ticket.clientEmail,
    caseType: ticket.caseType || "Immigration Case",
    refNumber: ticket.refNumber,
    expiryDate: (deadlineDate as Date).toISOString(),
    daysRemaining: deadlineInfo.daysRemaining,
    milestone: deadlineInfo.milestone || deadlineInfo.daysRemaining,
  });

  await sendMail({ to: ticket.clientEmail, subject, html });

  // Log as audit
  await db.auditLog.create({
    data: {
      action: "DEADLINE_REMINDER_SENT",
      ticketId: ticket.id,
      userId: user.userId,
      metadata: `Sent ${deadlineInfo.daysRemaining}-day deadline reminder to ${ticket.clientEmail}`,
    },
  });

  return NextResponse.json({
    success: true,
    message: `Reminder sent to ${ticket.clientEmail}`,
  });
}
