import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { Role } from "@/generated/prisma/enums";
import { cached } from "@/lib/redis";

// GET /api/analytics/revenue — Revenue tracking (Super Admin only)
export async function GET(request: NextRequest) {
  const { error } = await requireRole(Role.SUPER_ADMIN);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") || "all";

  const cacheKey = `analytics:revenue:${period}`;

  const data = await cached(cacheKey, 300, async () => {
    // Build date filter
    const dateFilter: Record<string, unknown> = {};
    const now = new Date();

    if (period === "month") {
      dateFilter.createdAt = {
        gte: new Date(now.getFullYear(), now.getMonth(), 1),
      };
    } else if (period === "quarter") {
      const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      dateFilter.createdAt = { gte: quarterStart };
    } else if (period === "year") {
      dateFilter.createdAt = { gte: new Date(now.getFullYear(), 0, 1) };
    }

    const [
      totalRevenue,
      paidRevenue,
      pendingRevenue,
      paymentsByType,
      recentPayments,
      ticketCount,
    ] = await Promise.all([
      db.payment.aggregate({
        where: dateFilter,
        _sum: { amount: true },
      }),
      db.payment.aggregate({
        where: { ...dateFilter, status: "PAID" },
        _sum: { amount: true },
      }),
      db.payment.aggregate({
        where: { ...dateFilter, status: "PENDING" },
        _sum: { amount: true },
      }),
      db.payment.groupBy({
        by: ["type"],
        where: { ...dateFilter, status: "PAID" },
        _sum: { amount: true },
        _count: { id: true },
      }),
      db.payment.findMany({
        where: dateFilter,
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          ticket: { select: { refNumber: true, clientName: true } },
          recordedBy: { select: { name: true } },
        },
      }),
      db.ticket.count({ where: dateFilter }),
    ]);

    const totalPaid = paidRevenue._sum.amount || 0;
    const avgRevenuePerTicket = ticketCount > 0 ? Math.round(totalPaid / ticketCount) : 0;

    return {
      totalRevenue: totalRevenue._sum.amount || 0,
      paidRevenue: totalPaid,
      pendingRevenue: pendingRevenue._sum.amount || 0,
      avgRevenuePerTicket,
      paymentsByType: paymentsByType.map((p) => ({
        type: p.type,
        total: p._sum.amount || 0,
        count: p._count.id,
      })),
      recentPayments,
      period,
    };
  });

  return NextResponse.json(data);
}
