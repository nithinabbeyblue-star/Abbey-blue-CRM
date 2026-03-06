import { db } from "@/lib/db";
import Link from "next/link";
import { STATUS_CONFIG, ORDERED_STATUSES } from "@/components/ui/status-badge";
import { StagnantCases } from "@/components/governance/stagnant-cases";
import { TicketStatus } from "@/generated/prisma/enums";

export async function SuperAdminDashboardContent() {
  const [
    totalTickets,
    activeUsers,
    approvedCount,
    rejectedCount,
    paidRevenue,
    statusCounts,
    activeCases,
    stagnantTickets,
  ] = await Promise.all([
    db.ticket.count(),
    db.user.count({ where: { status: "ACTIVE" } }),
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
    db.ticket.findMany({
      where: {
        status: { notIn: [TicketStatus.APPROVED, TicketStatus.REJECTED] },
      },
      orderBy: { updatedAt: "desc" },
      take: 20,
      select: {
        id: true,
        refNumber: true,
        clientName: true,
        clientPhone: true,
        caseType: true,
        status: true,
        priority: true,
        updatedAt: true,
        assignedTo: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
    }),
    db.ticket.findMany({
      where: {
        updatedAt: { lt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) },
        status: { notIn: [TicketStatus.APPROVED, TicketStatus.REJECTED] },
      },
      select: {
        id: true,
        refNumber: true,
        clientName: true,
        status: true,
        updatedAt: true,
        assignedTo: { select: { id: true, name: true } },
        createdBy: { select: { name: true } },
      },
      orderBy: { updatedAt: "asc" },
    }),
  ]);

  const closed = approvedCount + rejectedCount;
  const conversionRate = closed > 0 ? Math.round((approvedCount / closed) * 100) : 0;
  const revenue = paidRevenue._sum.amount || 0;

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(amount);

  const PRIORITY_LABELS: Record<number, { label: string; color: string }> = {
    0: { label: "Normal", color: "text-muted" },
    1: { label: "High", color: "text-orange-600" },
    2: { label: "Urgent", color: "text-red-600 font-bold" },
  };

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
    <>
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

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Cases by Status</h2>
            <Link href="/super-admin/tickets" className="text-sm text-primary hover:underline">View all</Link>
          </div>
          {Object.keys(statusMap).length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">No tickets yet.</p>
          ) : (
            <div className="space-y-3">
              {ORDERED_STATUSES.map((status) => {
                const count = statusMap[status] || 0;
                if (count === 0) return null;
                const pct = totalTickets > 0 ? Math.round((count / totalTickets) * 100) : 0;
                return (
                  <div key={status} className="flex items-center gap-3">
                    <span
                      className={`inline-block w-28 rounded-full px-2.5 py-1 text-center text-xs font-medium ${
                        STATUS_CONFIG[status]?.bg ?? "bg-gray-100"
                      } ${STATUS_CONFIG[status]?.text ?? "text-gray-700"}`}
                    >
                      {STATUS_CONFIG[status]?.label ?? status.replace(/_/g, " ")}
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
              })}
            </div>
          )}
        </div>

        {/* Active Cases — replaces Recent Activity */}
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <h2 className="text-lg font-semibold text-foreground">Active Cases</h2>
            <Link href="/super-admin/tickets" className="text-sm text-primary hover:underline">View all</Link>
          </div>
          {activeCases.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">No active cases.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-gray-50/50">
                  <th className="px-4 py-3 text-left font-medium text-muted">Ref</th>
                  <th className="px-4 py-3 text-left font-medium text-muted">Client</th>
                  <th className="px-4 py-3 text-left font-medium text-muted">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-muted">Priority</th>
                  <th className="px-4 py-3 text-left font-medium text-muted">Assigned To</th>
                </tr>
              </thead>
              <tbody>
                {activeCases.map((ticket) => {
                  const pri = PRIORITY_LABELS[ticket.priority] || PRIORITY_LABELS[0];
                  return (
                    <tr
                      key={ticket.id}
                      className="border-b border-border last:border-0 hover:bg-gray-50/50"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/super-admin/tickets/${ticket.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {ticket.refNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{ticket.clientName}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${
                            STATUS_CONFIG[ticket.status]?.bg ?? "bg-gray-100"
                          } ${STATUS_CONFIG[ticket.status]?.text ?? "text-gray-700"}`}
                        >
                          {STATUS_CONFIG[ticket.status]?.label ?? ticket.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs ${pri.color}`}>{pri.label}</span>
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {ticket.assignedTo?.name || (
                          <span className="text-xs text-amber-600 font-medium">Unassigned</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <StagnantCases
        tickets={stagnantTickets.map((t) => ({
          ...t,
          updatedAt: t.updatedAt.toISOString(),
        }))}
      />
    </>
  );
}
