"use client";

import { useEffect, useState } from "react";

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
  ticket: { refNumber: string; clientName: string };
  recordedBy: { name: string };
}

interface RevenueData {
  totalRevenue: number;
  paidRevenue: number;
  pendingRevenue: number;
  avgRevenuePerTicket: number;
  paymentsByType: PaymentByType[];
  recentPayments: RecentPayment[];
  period: string;
}

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  PAID: "bg-green-100 text-green-700",
  PENDING: "bg-yellow-100 text-yellow-700",
  REFUNDED: "bg-red-100 text-red-700",
};

export default function FinancePage() {
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("all");

  useEffect(() => {
    async function fetchRevenue() {
      setLoading(true);
      const res = await fetch(`/api/analytics/revenue?period=${period}`);
      const json = await res.json();
      setData(json);
      setLoading(false);
    }
    fetchRevenue();
  }, [period]);

  const periods = [
    { value: "month", label: "This Month" },
    { value: "quarter", label: "This Quarter" },
    { value: "year", label: "This Year" },
    { value: "all", label: "All Time" },
  ];

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
    }).format(amount);
  }

  if (loading) {
    return <div className="py-16 text-center text-sm text-muted">Loading financial data...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Finance</h1>
          <p className="mt-1 text-sm text-muted">Revenue tracking and payment overview</p>
        </div>
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
      </div>

      {/* Revenue Stats */}
      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <p className="text-sm font-medium text-muted">Total Revenue</p>
          <p className="mt-2 text-3xl font-bold text-foreground">
            {formatCurrency(data?.totalRevenue || 0)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <p className="text-sm font-medium text-muted">Paid</p>
          <p className="mt-2 text-3xl font-bold text-success">
            {formatCurrency(data?.paidRevenue || 0)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <p className="text-sm font-medium text-muted">Pending</p>
          <p className="mt-2 text-3xl font-bold text-warning">
            {formatCurrency(data?.pendingRevenue || 0)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <p className="text-sm font-medium text-muted">Avg per Ticket</p>
          <p className="mt-2 text-3xl font-bold text-foreground">
            {formatCurrency(data?.avgRevenuePerTicket || 0)}
          </p>
        </div>
      </div>

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
                    <p className="text-sm font-medium text-foreground">
                      {payment.ticket.clientName}
                    </p>
                    <p className="text-xs text-muted">
                      {payment.ticket.refNumber} &bull; {payment.type.replace(/_/g, " ")} &bull; By {payment.recordedBy.name}
                    </p>
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
