import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { Role, TicketStatus } from "@/generated/prisma/enums";

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

  // Role-based where clause — same pattern as /api/tickets
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
      // See everything
      break;
  }

  const [approved, rejected] = await Promise.all([
    db.ticket.findMany({
      where: { ...where, status: TicketStatus.APPROVED },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        refNumber: true,
        clientName: true,
        clientPhone: true,
        caseType: true,
        priority: true,
        ablFee: true,
        govFee: true,
        paidAmount: true,
        createdAt: true,
        updatedAt: true,
        createdBy: { select: { name: true } },
        assignedTo: { select: { name: true } },
      },
    }),
    db.ticket.findMany({
      where: { ...where, status: TicketStatus.REJECTED },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        refNumber: true,
        clientName: true,
        clientPhone: true,
        caseType: true,
        priority: true,
        ablFee: true,
        govFee: true,
        paidAmount: true,
        createdAt: true,
        updatedAt: true,
        createdBy: { select: { name: true } },
        assignedTo: { select: { name: true } },
      },
    }),
  ]);

  return NextResponse.json({ approved, rejected });
}
