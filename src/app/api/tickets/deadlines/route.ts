import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { Role, TicketStatus } from "@/generated/prisma/enums";
import { calculateDeadline } from "@/lib/deadlines";

const ALL_ROLES = [
  Role.SUPER_ADMIN,
  Role.SALES_MANAGER,
  Role.ADMIN_MANAGER,
  Role.SALES,
  Role.ADMIN,
] as const;

export async function GET() {
  const { user, error } = await requireRole(...ALL_ROLES);
  if (error) return error;

  // Role-based where clause
  let where: Record<string, unknown> = {};

  switch (user.role) {
    case "SALES":
      where = { createdById: user.userId };
      break;
    case "ADMIN":
      where = { assignedToId: user.userId };
      break;
    case "SALES_MANAGER": {
      const salesUsers = await db.user.findMany({
        where: { role: { in: [Role.SALES, Role.SALES_MANAGER] } },
        select: { id: true },
      });
      where = { createdById: { in: salesUsers.map((u) => u.id) } };
      break;
    }
    case "ADMIN_MANAGER":
    case "SUPER_ADMIN":
      break;
  }

  // Get all active cases with deadline dates
  const tickets = await db.ticket.findMany({
    where: {
      ...where,
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
    orderBy: { caseDeadline: "asc" },
    select: {
      id: true,
      refNumber: true,
      clientName: true,
      clientPhone: true,
      clientEmail: true,
      caseType: true,
      status: true,
      priority: true,
      caseDeadline: true,
      caseStartDate: true,
      caseEndDate: true,
      adsFinishingDate: true,
      visaExpiryDate: true,
      createdAt: true,
      createdBy: { select: { name: true } },
      assignedTo: { select: { name: true } },
    },
  });

  // Calculate deadline info for each
  const casesWithDeadlines = tickets
    .map((t) => {
      // Use earliest available deadline
      const deadlineDate = t.visaExpiryDate || t.caseDeadline || t.caseEndDate || t.adsFinishingDate;
      const deadline = calculateDeadline(deadlineDate);

      return {
        ...t,
        caseDeadline: t.caseDeadline?.toISOString() || null,
        caseStartDate: t.caseStartDate?.toISOString() || null,
        caseEndDate: t.caseEndDate?.toISOString() || null,
        adsFinishingDate: t.adsFinishingDate?.toISOString() || null,
        visaExpiryDate: t.visaExpiryDate?.toISOString() || null,
        createdAt: t.createdAt.toISOString(),
        deadlineInfo: deadline,
      };
    })
    .filter((t) => t.deadlineInfo !== null)
    .sort((a, b) => (a.deadlineInfo?.daysRemaining ?? 999) - (b.deadlineInfo?.daysRemaining ?? 999));

  return NextResponse.json({ cases: casesWithDeadlines });
}
