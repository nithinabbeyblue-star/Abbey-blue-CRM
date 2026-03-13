import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { TicketStatus, NotificationType } from "@/generated/prisma/enums";
import { sendMail } from "@/lib/mail";
import { calculateDeadline, generateReminderEmail, MILESTONES } from "@/lib/deadlines";

/**
 * Daily Cron Job: Scans all active cases for milestone deadlines.
 *
 * - 120 days: Creates draft notification for Sales
 * - 90 days: Sends automated email to client + notifies Sales
 * - 60 days: Notifies Manager (urgent)
 * - 30 days: Notifies Admin/Super Admin (critical)
 * - 14/7 days: Notifies everyone assigned (critical)
 *
 * Secure via CRON_SECRET header (set in Vercel Cron).
 * Schedule: Run daily at 08:00 UTC via vercel.json or external cron.
 *
 * Example vercel.json:
 *   { "crons": [{ "path": "/api/cron/check-expiry", "schedule": "0 8 * * *" }] }
 */
export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get all active tickets with deadline dates
  const tickets = await db.ticket.findMany({
    where: {
      status: {
        notIn: [TicketStatus.APPROVED, TicketStatus.REJECTED],
      },
      OR: [
        { caseDeadline: { not: null } },
        { caseEndDate: { not: null } },
        { adsFinishingDate: { not: null } },
        { visaExpiryDate: { not: null } },
      ],
    },
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
      createdBy: { select: { id: true, name: true, role: true } },
      assignedTo: { select: { id: true, name: true, role: true } },
    },
  });

  let emailsSent = 0;
  let notificationsCreated = 0;

  for (const ticket of tickets) {
    const deadlineDate = ticket.visaExpiryDate || ticket.caseDeadline || ticket.caseEndDate || ticket.adsFinishingDate;
    const deadline = calculateDeadline(deadlineDate);
    if (!deadline) continue;

    // Check if this exact milestone was already notified today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    const existingNotif = await db.notification.findFirst({
      where: {
        type: NotificationType.DEADLINE_ALERT,
        createdAt: { gte: today, lte: todayEnd },
        metadata: { contains: ticket.id },
      },
    });

    if (existingNotif) continue; // Already processed today

    // Determine which milestone we're at
    const hitMilestone = MILESTONES.find((m) => deadline.daysRemaining <= m && deadline.daysRemaining > 0);
    if (!hitMilestone && deadline.daysRemaining > 0) continue; // No milestone hit yet

    // Collect users to notify based on milestone
    const usersToNotify: string[] = [];
    const milestoneLabel =
      deadline.daysRemaining <= 0
        ? "EXPIRED"
        : `${hitMilestone}-DAY`;

    // Always notify case owner and worker
    if (ticket.createdById) usersToNotify.push(ticket.createdById);
    if (ticket.assignedToId && ticket.assignedToId !== ticket.createdById) {
      usersToNotify.push(ticket.assignedToId);
    }

    // For 60d and below: also notify all managers
    if (deadline.daysRemaining <= 60) {
      const managers = await db.user.findMany({
        where: {
          role: { in: ["SUPER_ADMIN", "SALES_MANAGER", "ADMIN_MANAGER"] },
          status: "ACTIVE",
        },
        select: { id: true },
      });
      for (const m of managers) {
        if (!usersToNotify.includes(m.id)) usersToNotify.push(m.id);
      }
    }

    // Create notifications for all relevant users
    for (const uid of usersToNotify) {
      await db.notification.create({
        data: {
          type: NotificationType.DEADLINE_ALERT,
          title: `${milestoneLabel} Alert: ${ticket.refNumber}`,
          body: `${ticket.clientName}'s case ${deadline.daysRemaining <= 0 ? "has expired" : `expires in ${deadline.daysRemaining} days`}. ${deadline.urgency === "critical" || deadline.urgency === "expired" ? "Immediate action required." : "Please review."}`,
          userId: uid,
          metadata: JSON.stringify({
            ticketId: ticket.id,
            milestone: hitMilestone,
            daysRemaining: deadline.daysRemaining,
            urgency: deadline.urgency,
          }),
        },
      });
      notificationsCreated++;
    }

    // Auto-send email at 90-day milestone (or below if client has email)
    if (deadline.daysRemaining <= 90 && deadline.daysRemaining > 0 && ticket.clientEmail) {
      // Check if we already emailed for this case this month
      const monthAgo = new Date();
      monthAgo.setDate(monthAgo.getDate() - 30);

      const recentEmail = await db.auditLog.findFirst({
        where: {
          action: "DEADLINE_REMINDER_SENT",
          ticketId: ticket.id,
          createdAt: { gte: monthAgo },
        },
      });

      if (!recentEmail) {
        const { subject, html } = generateReminderEmail({
          clientName: ticket.clientName,
          clientEmail: ticket.clientEmail,
          caseType: ticket.caseType || "Immigration Case",
          refNumber: ticket.refNumber,
          expiryDate: (deadlineDate as Date).toISOString(),
          daysRemaining: deadline.daysRemaining,
          milestone: hitMilestone || deadline.daysRemaining,
        });

        await sendMail({ to: ticket.clientEmail, subject, html });

        // Log the email
        await db.auditLog.create({
          data: {
            action: "DEADLINE_REMINDER_SENT",
            ticketId: ticket.id,
            userId: ticket.createdById,
            metadata: `Auto-sent ${milestoneLabel} reminder to ${ticket.clientEmail} (${deadline.daysRemaining}d remaining)`,
          },
        });

        emailsSent++;
      }
    }
  }

  return NextResponse.json({
    success: true,
    processed: tickets.length,
    emailsSent,
    notificationsCreated,
    timestamp: new Date().toISOString(),
  });
}
