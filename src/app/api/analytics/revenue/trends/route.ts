import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { Role } from "@/generated/prisma/enums";
import { cached } from "@/lib/redis";
import { calcNetProfit, calcVatLiability } from "@/lib/finance.server";

interface MonthBucket {
  month: string; // "2026-03"
  label: string; // "Mar 2026"
  revenue: number;
  vatLiability: number;
  netProfit: number;
}

// GET /api/analytics/revenue/trends — Monthly trend data (Super Admin only)
export async function GET() {
  const { error } = await requireRole(Role.SUPER_ADMIN);
  if (error) return error;

  const data = await cached("analytics:revenue:trends", 600, async () => {
    const now = new Date();
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const tickets = await db.ticket.findMany({
      where: {
        ablFee: { not: null },
        createdAt: { gte: twelveMonthsAgo },
      },
      select: {
        ablFee: true,
        govFee: true,
        adverts: true,
        createdAt: true,
      },
    });

    // Build 12 month buckets
    const buckets = new Map<string, MonthBucket>();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-IE", { month: "short", year: "numeric" });
      buckets.set(key, { month: key, label, revenue: 0, vatLiability: 0, netProfit: 0 });
    }

    // Aggregate tickets into buckets
    for (const t of tickets) {
      const d = new Date(t.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const bucket = buckets.get(key);
      if (!bucket) continue;

      const revenue = (t.ablFee ?? 0) + (t.govFee ?? 0) + (t.adverts ?? 0);
      bucket.revenue += revenue;
      bucket.vatLiability += calcVatLiability(t.ablFee);
      bucket.netProfit += calcNetProfit(t.ablFee, t.govFee, t.adverts);
    }

    // Round all values
    const trends = Array.from(buckets.values()).map((b) => ({
      ...b,
      revenue: Math.round(b.revenue * 100) / 100,
      vatLiability: Math.round(b.vatLiability * 100) / 100,
      netProfit: Math.round(b.netProfit * 100) / 100,
    }));

    return { trends };
  });

  return NextResponse.json(data);
}
