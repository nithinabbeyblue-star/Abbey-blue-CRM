import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-700",
  CONTACTED: "bg-indigo-100 text-indigo-700",
  DOCS_PENDING: "bg-yellow-100 text-yellow-700",
  DOCS_RECEIVED: "bg-orange-100 text-orange-700",
  SUBMITTED: "bg-purple-100 text-purple-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  ON_HOLD: "bg-gray-100 text-gray-700",
};

export default async function SuperAdminDashboard() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [
    totalTickets,
    activeUsers,
    approvedCount,
    rejectedCount,
    paidRevenue,
    statusCounts,
    recentActivity,
  ] = await Promise.all([
    db.ticket.count(),
    db.user.count({ where: { isActive: true } }),
    db.ticket.count({ where: { status: "APPROVED" } }),
    db.ticket.count({ where: { status: "REJECTED" } }),
    db.payment.aggregate({
      where: { status: "PAID" },
      _sum: { amount: true },
    }),
    db.ticket.groupBy({
      by: ["status"],
      _count: { id: true },
    }),
    db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        user: { select: { name: true } },
        ticket: { select: { refNumber: true } },
      },
    }),
  ]);

  const closed = approvedCount + rejectedCount;
  const conversionRate = closed > 0 ? Math.round((approvedCount / closed) * 100) : 0;
  const revenue = paidRevenue._sum.amount || 0;

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(amount);

  const stats = [
    { label: "Total Tickets", value: String(totalTickets), color: "bg-blue-500" },
    { label: "Active Users", value: String(activeUsers), color: "bg-green-500" },
    { label: "Approval Rate", value: `${conversionRate}%`, color: "bg-emerald-500" },
    { label: "Revenue (Paid)", value: formatCurrency(revenue), color: "bg-purple-500" },
  ];

  const statusMap: Record<string, number> = {};
  for (const s of statusCounts) {
    statusMap[s.status] = s._count.id;
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Welcome back, {user.name}
          </h1>
          <p className="mt-1 text-sm text-muted">
            Super Admin Dashboard — System overview and analytics
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/super-admin/users"
            className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-gray-50"
          >
            Manage Users
          </Link>
          <Link
            href="/super-admin/finance"
            className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover"
          >
            Finance
          </Link>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-border bg-card p-6 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted">{stat.label}</p>
              <div className={`h-3 w-3 rounded-full ${stat.color}`} />
            </div>
            <p className="mt-2 text-3xl font-bold text-foreground">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Status Breakdown + Recent Activity */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Cases by Status */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Cases by Status</h2>
            <Link href="/super-admin/tickets" className="text-sm text-primary hover:underline">View all</Link>
          </div>
          {Object.keys(statusMap).length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">No tickets yet.</p>
          ) : (
            <div className="space-y-3">
              {["NEW", "CONTACTED", "DOCS_PENDING", "DOCS_RECEIVED", "SUBMITTED", "APPROVED", "REJECTED", "ON_HOLD"].map(
                (status) => {
                  const count = statusMap[status] || 0;
                  if (count === 0) return null;
                  const pct = totalTickets > 0 ? Math.round((count / totalTickets) * 100) : 0;
                  return (
                    <div key={status} className="flex items-center gap-3">
                      <span
                        className={`inline-block w-28 rounded-full px-2.5 py-1 text-center text-xs font-medium ${
                          STATUS_COLORS[status]
                        }`}
                      >
                        {status.replace(/_/g, " ")}
                      </span>
                      <div className="flex-1">
                        <div className="h-2 rounded-full bg-gray-100">
                          <div
                            className="h-2 rounded-full bg-primary transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                      <span className="w-10 text-right text-sm font-medium text-foreground">
                        {count}
                      </span>
                    </div>
                  );
                }
              )}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Recent Activity</h2>
          {recentActivity.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">No activity yet.</p>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 border-b border-border pb-3 last:border-0 last:pb-0"
                >
                  <div className="mt-0.5 h-2 w-2 rounded-full bg-primary" />
                  <div className="flex-1">
                    <p className="text-sm text-foreground">
                      <span className="font-medium">{log.user.name}</span>{" "}
                      {log.action.replace(/_/g, " ").toLowerCase()}
                      {" on "}
                      <span className="font-medium">{log.ticket.refNumber}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {new Date(log.createdAt).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
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
