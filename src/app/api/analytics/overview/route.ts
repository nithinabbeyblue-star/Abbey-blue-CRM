import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { Role } from "@/generated/prisma/enums";
import { cached } from "@/lib/redis";

// GET /api/analytics/overview — Dashboard analytics (Super Admin only)
export async function GET() {
  const { error } = await requireRole(Role.SUPER_ADMIN);
  if (error) return error;

  const data = await cached("analytics:overview", 300, async () => {
    const [
      totalTickets,
      statusCounts,
      sourceBreakdown,
      totalUsers,
      activeUsers,
      recentActivity,
    ] = await Promise.all([
      db.ticket.count(),
      db.ticket.groupBy({
        by: ["status"],
        _count: { id: true },
      }),
      db.ticket.groupBy({
        by: ["source"],
        _count: { id: true },
      }),
      db.user.count(),
      db.user.count({ where: { isActive: true } }),
      db.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          user: { select: { name: true } },
          ticket: { select: { refNumber: true } },
        },
      }),
    ]);

    const statusMap: Record<string, number> = {};
    for (const s of statusCounts) {
      statusMap[s.status] = s._count.id;
    }

    const sourceMap: Record<string, number> = {};
    for (const s of sourceBreakdown) {
      sourceMap[s.source] = s._count.id;
    }

    const approved = statusMap["APPROVED"] || 0;
    const rejected = statusMap["REJECTED"] || 0;
    const closed = approved + rejected;
    const conversionRate = closed > 0 ? Math.round((approved / closed) * 100) : 0;

    return {
      totalTickets,
      statusBreakdown: statusMap,
      sourceBreakdown: sourceMap,
      totalUsers,
      activeUsers,
      conversionRate,
      recentActivity,
    };
  });

  return NextResponse.json(data);
}
