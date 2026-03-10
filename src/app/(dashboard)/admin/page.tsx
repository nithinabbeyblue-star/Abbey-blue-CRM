import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";
import { Role, TicketStatus } from "@/generated/prisma/enums";
import { STATUS_CONFIG } from "@/components/ui/status-badge";

export default async function AdminDashboard() {
  const user = await getCurrentUser();
  if (!user) return null;

  const isManager = user.role === Role.ADMIN_MANAGER || user.role === Role.SUPER_ADMIN;

  // Admin Manager sees all tickets, Admin sees only assigned
  const where = isManager ? {} : { assignedToId: user.userId };
  const activeWhere = { ...where, status: { notIn: [TicketStatus.APPROVED, TicketStatus.REJECTED] } };

  const [total, unassigned, docCollection, submitted, recentTickets] =
    await Promise.all([
      db.ticket.count({ where: activeWhere }),
      db.ticket.count({ where: { assignedToId: null, status: { notIn: [TicketStatus.APPROVED, TicketStatus.REJECTED] } } }),
      db.ticket.count({
        where: { ...where, status: "DOC_COLLECTION" },
      }),
      db.ticket.count({ where: { ...where, status: "SUBMITTED" } }),
      db.ticket.findMany({
        where: activeWhere,
        orderBy: { updatedAt: "desc" },
        take: 5,
        include: {
          createdBy: { select: { name: true } },
          assignedTo: { select: { name: true } },
        },
      }),
    ]);

  const stats = isManager
    ? [
        { label: "Active Cases", value: total, color: "bg-blue-500" },
        { label: "Unassigned", value: unassigned, color: "bg-red-500" },
        { label: "Doc Collection", value: docCollection, color: "bg-yellow-500" },
        { label: "Submitted", value: submitted, color: "bg-purple-500" },
      ]
    : [
        { label: "Active Cases", value: total, color: "bg-blue-500" },
        { label: "Doc Collection", value: docCollection, color: "bg-yellow-500" },
        { label: "Submitted", value: submitted, color: "bg-purple-500" },
      ];

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Welcome back, {user.name}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {isManager
              ? "Admin Manager Dashboard — Assign and oversee cases"
              : "Admin Dashboard — Manage your assigned cases"}
          </p>
        </div>
        {isManager && (
          <Link
            href="/admin/assignments"
            className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
          >
            Assign Tickets
          </Link>
        )}
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

      {/* Recent Cases */}
      <div className="mt-8 rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">
            {isManager ? "Recent Tickets" : "Active Cases"}
          </h2>
          <Link
            href={isManager ? "/admin/tickets" : "/admin/my-cases"}
            className="text-sm font-medium text-primary hover:underline"
          >
            View all
          </Link>
        </div>
        {recentTickets.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted">
            {isManager
              ? "No tickets in the system yet."
              : "No cases assigned to you yet."}
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-gray-50/50">
                <th className="px-6 py-3 text-left font-medium text-muted">Ref</th>
                <th className="px-6 py-3 text-left font-medium text-muted">Client</th>
                <th className="px-6 py-3 text-left font-medium text-muted">Status</th>
                <th className="px-6 py-3 text-left font-medium text-muted">
                  {isManager ? "Assigned To" : "Created By"}
                </th>
                <th className="px-6 py-3 text-left font-medium text-muted">Updated</th>
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
                      href={`/admin/tickets/${ticket.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {ticket.refNumber}
                    </Link>
                  </td>
                  <td className="px-6 py-3">
                    <div className="font-medium text-foreground">{ticket.clientName}</div>
                    <div className="text-xs text-muted">{ticket.clientPhone}</div>
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
                    {isManager
                      ? ticket.assignedTo?.name || "Unassigned"
                      : ticket.createdBy?.name}
                  </td>
                  <td className="px-6 py-3 text-xs text-muted">
                    {new Date(ticket.updatedAt).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}
