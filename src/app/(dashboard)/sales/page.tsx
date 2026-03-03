import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";
import { STATUS_CONFIG } from "@/components/ui/status-badge";

export default async function SalesDashboard() {
  const user = await getCurrentUser();
  if (!user) return null;

  const where = { createdById: user.userId };

  const [total, newCount, inProgress, approved, recentTickets] =
    await Promise.all([
      db.ticket.count({ where }),
      db.ticket.count({ where: { ...where, status: "LEAD" } }),
      db.ticket.count({
        where: {
          ...where,
          status: {
            in: ["DOC_COLLECTION", "SUBMITTED", "IN_PROGRESS"],
          },
        },
      }),
      db.ticket.count({ where: { ...where, status: "APPROVED" } }),
      db.ticket.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          assignedTo: { select: { name: true } },
        },
      }),
    ]);

  const stats = [
    { label: "My Tickets", value: total, color: "bg-blue-500" },
    { label: "New Leads", value: newCount, color: "bg-green-500" },
    { label: "In Progress", value: inProgress, color: "bg-yellow-500" },
    { label: "Approved", value: approved, color: "bg-emerald-500" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Welcome back, {user.name}
          </h1>
          <p className="mt-1 text-sm text-muted">
            Sales Dashboard — Create and track your leads
          </p>
        </div>
        <Link
          href="/sales/tickets/new"
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
        >
          + New Ticket
        </Link>
      </div>

      {/* Stats Cards */}
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

      {/* Recent Tickets */}
      <div className="mt-8 rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">
            Recent Tickets
          </h2>
          <Link
            href="/sales/tickets"
            className="text-sm font-medium text-primary hover:underline"
          >
            View all
          </Link>
        </div>
        {recentTickets.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-muted">
              No tickets yet. Create your first lead to get started.
            </p>
            <Link
              href="/sales/tickets/new"
              className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
            >
              Create ticket
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-gray-50/50">
                <th className="px-6 py-3 text-left font-medium text-muted">
                  Ref
                </th>
                <th className="px-6 py-3 text-left font-medium text-muted">
                  Client
                </th>
                <th className="px-6 py-3 text-left font-medium text-muted">
                  Status
                </th>
                <th className="px-6 py-3 text-left font-medium text-muted">
                  Assigned To
                </th>
                <th className="px-6 py-3 text-left font-medium text-muted">
                  Created
                </th>
              </tr>
            </thead>
            <tbody>
              {recentTickets.map((ticket) => (
                <tr
                  key={ticket.id}
                  className="border-b border-border last:border-0 hover:bg-gray-50/50"
                >
                  <td className="px-6 py-3">
                    <Link
                      href={`/sales/tickets/${ticket.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {ticket.refNumber}
                    </Link>
                  </td>
                  <td className="px-6 py-3">
                    <div className="font-medium text-foreground">
                      {ticket.clientName}
                    </div>
                    <div className="text-xs text-muted">
                      {ticket.clientPhone}
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${
                        STATUS_CONFIG[ticket.status]?.bg ?? "bg-gray-100"
                      } ${STATUS_CONFIG[ticket.status]?.text ?? "text-gray-700"}`}
                    >
                      {STATUS_CONFIG[ticket.status]?.label ?? ticket.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-muted">
                    {ticket.assignedTo?.name || "Unassigned"}
                  </td>
                  <td className="px-6 py-3 text-xs text-muted">
                    {new Date(ticket.createdAt).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
