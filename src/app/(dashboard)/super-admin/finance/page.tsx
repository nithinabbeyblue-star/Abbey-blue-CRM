"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { formatCurrency } from "@/constants/finance";
import PusherClient from "pusher-js";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface PaymentByType {
  type: string;
  total: number;
  count: number;
}

interface RecentPayment {
  id: string;
  amount: number;
  currency: string;
  type: string;
  status: string;
  paidAt: string | null;
  createdAt: string;
  ticket: { id: string; refNumber: string; clientName: string };
  recordedBy: { name: string };
}

interface RevenueData {
  totalRevenue: number;
  paidRevenue: number;
  pendingRevenue: number;
  avgRevenuePerTicket: number;
  paymentsByType: PaymentByType[];
  recentPayments: RecentPayment[];
  ticketRevenue: number;
  netProfit: number;
  vatLiability: number;
  profitMargin: number;
  collected: number;
  outstanding: number;
  ticketCount: number;
  period: string;
}

interface TrendPoint {
  month: string;
  label: string;
  revenue: number;
  vatLiability: number;
  netProfit: number;
}

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  PAID: "bg-green-100 text-green-700",
  PENDING: "bg-yellow-100 text-yellow-700",
  REFUNDED: "bg-red-100 text-red-700",
};

function marginColor(margin: number): string {
  if (margin >= 50) return "text-green-600";
  if (margin >= 25) return "text-yellow-600";
  return "text-red-600";
}

export default function FinancePage() {
  const [data, setData] = useState<RevenueData | null>(null);
  const [trends, setTrends] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState("all");

  const fetchData = useCallback(async () => {
    const [revRes, trendRes] = await Promise.all([
      fetch(`/api/analytics/revenue?period=${period}`),
      fetch("/api/analytics/revenue/trends"),
    ]);
    if (revRes.ok) {
      setData(await revRes.json());
    }
    if (trendRes.ok) {
      const json = await trendRes.json();
      setTrends(json.trends || []);
    }
    setLoading(false);
  }, [period]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  // Pusher real-time subscription (graceful degradation)
  useEffect(() => {
    const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
    if (!pusherKey || !pusherCluster) return;

    const pusher = new PusherClient(pusherKey, {
      cluster: pusherCluster,
      authEndpoint: "/api/pusher/auth",
    });

    const channel = pusher.subscribe("finance-dashboard");
    channel.bind("finance-updated", () => {
      fetchData();
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe("finance-dashboard");
      pusher.disconnect();
    };
  }, [fetchData]);

  async function handleRefresh() {
    setRefreshing(true);
    await fetch("/api/analytics/revenue/invalidate", { method: "POST" });
    await fetchData();
    setRefreshing(false);
  }

  const periods = [
    { value: "month", label: "This Month" },
    { value: "quarter", label: "This Quarter" },
    { value: "year", label: "This Year" },
    { value: "all", label: "All Time" },
  ];

  if (loading) {
    return <div className="py-16 text-center text-sm text-muted">Loading financial data...</div>;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Finance</h1>
          <p className="mt-1 text-sm text-muted">Revenue tracking, profit analysis & payment overview</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-2">
            {periods.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  period === p.value
                    ? "bg-primary text-white"
                    : "bg-white text-muted border border-border hover:bg-gray-50"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Stat Cards — 3×2 grid */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <p className="text-sm font-medium text-muted">Total Revenue</p>
          <p className="mt-2 text-3xl font-bold text-foreground">
            {formatCurrency(data?.ticketRevenue || 0)}
          </p>
          <p className="mt-1 text-xs text-muted">{data?.ticketCount || 0} tickets with fees</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <p className="text-sm font-medium text-muted">Net Profit</p>
          <p className="mt-2 text-3xl font-bold text-green-600">
            {formatCurrency(data?.netProfit || 0)}
          </p>
          <p className="mt-1 text-xs text-muted">After VAT, gov fees & adverts</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <p className="text-sm font-medium text-muted">Profit Margin</p>
          <p className={`mt-2 text-3xl font-bold ${marginColor(data?.profitMargin || 0)}`}>
            {data?.profitMargin?.toFixed(1) || "0.0"}%
          </p>
          <p className="mt-1 text-xs text-muted">Net profit / total revenue</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <p className="text-sm font-medium text-muted">Collected</p>
          <p className="mt-2 text-3xl font-bold text-success">
            {formatCurrency(data?.collected || 0)}
          </p>
          <p className="mt-1 text-xs text-muted">Total paid by clients</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <p className="text-sm font-medium text-muted">Outstanding</p>
          <p className="mt-2 text-3xl font-bold text-warning">
            {formatCurrency(data?.outstanding || 0)}
          </p>
          <p className="mt-1 text-xs text-muted">Due / pending collection</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <p className="text-sm font-medium text-muted">VAT Liability</p>
          <p className="mt-2 text-3xl font-bold text-foreground">
            {formatCurrency(data?.vatLiability || 0)}
          </p>
          <p className="mt-1 text-xs text-muted">23% Irish VAT in ABL fees</p>
        </div>
      </div>

      {/* Monthly Trends Chart */}
      {trends.length > 0 && (
        <div className="mt-8 rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Monthly Trends</h2>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={trends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis
                tick={{ fontSize: 12 }}
                tickFormatter={(v: number) => `€${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any, name: any) => [
                  formatCurrency(Number(value) || 0),
                  String(name),
                ]}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="revenue"
                name="Revenue"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="vatLiability"
                name="VAT Liability"
                stroke="#f97316"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="netProfit"
                name="Net Profit"
                stroke="#22c55e"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Bottom row — Revenue by Type + Recent Payments */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Revenue by Type */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Revenue by Type</h2>
          {!data?.paymentsByType?.length ? (
            <p className="py-8 text-center text-sm text-muted">
              No payment data yet. Payments will appear once recorded against tickets.
            </p>
          ) : (
            <div className="space-y-3">
              {data.paymentsByType.map((pt) => (
                <div key={pt.type} className="flex items-center justify-between rounded-lg border border-border p-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">{pt.type.replace(/_/g, " ")}</p>
                    <p className="text-xs text-muted">{pt.count} payments</p>
                  </div>
                  <p className="text-lg font-bold text-foreground">{formatCurrency(pt.total)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Payments */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Recent Payments</h2>
          {!data?.recentPayments?.length ? (
            <p className="py-8 text-center text-sm text-muted">
              No payments recorded yet.
            </p>
          ) : (
            <div className="space-y-3">
              {data.recentPayments.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0">
                  <div>
                    <Link href={`/super-admin/tickets/${payment.ticket.id}`} className="block hover:opacity-80">
                      <p className="text-sm font-medium text-foreground">
                        {payment.ticket.clientName}
                      </p>
                      <p className="text-xs text-muted">
                        <span className="text-primary hover:underline">{payment.ticket.refNumber}</span> &bull; {payment.type.replace(/_/g, " ")} &bull; By {payment.recordedBy.name}
                      </p>
                    </Link>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-foreground">
                      {formatCurrency(payment.amount)}
                    </p>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${PAYMENT_STATUS_COLORS[payment.status] || "bg-gray-100 text-gray-700"}`}>
                      {payment.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
