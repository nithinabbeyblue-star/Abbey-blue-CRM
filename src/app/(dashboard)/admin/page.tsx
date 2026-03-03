import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";
import { Role } from "@/generated/prisma/enums";

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

export default async function AdminDashboard() {
  const user = await getCurrentUser();
  if (!user) return null;

  const isCoordinator = user.role === Role.KEY_COORDINATOR || user.role === Role.SUPER_ADMIN;

  // Key Coordinator sees all tickets, Admin sees only assigned
  const where = isCoordinator ? {} : { assignedToId: user.userId };

  const [total, unassigned, docsPending, submitted, approved, recentTickets] =
    await Promise.all([
      db.ticket.count({ where }),
      db.ticket.count({ where: { assignedToId: null } }),
      db.ticket.count({
        where: { ...where, status: "DOCS_PENDING" },
      }),
      db.ticket.count({ where: { ...where, status: "SUBMITTED" } }),
      db.ticket.count({ where: { ...where, status: "APPROVED" } }),
      db.ticket.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        take: 5,
        include: {
          createdBy: { select: { name: true } },
          assignedTo: { select: { name: true } },
        },
      }),
    ]);

  const stats = isCoordinator
    ? [
        { label: "Total Tickets", value: total, color: "bg-blue-500" },
        { label: "Unassigned", value: unassigned, color: "bg-red-500" },
        { label: "Docs Pending", value: docsPending, color: "bg-yellow-500" },
        { label: "Approved", value: approved, color: "bg-emerald-500" },
      ]
    : [
        { label: "Assigned to Me", value: total, color: "bg-blue-500" },
        { label: "Docs Pending", value: docsPending, color: "bg-yellow-500" },
        { label: "Submitted", value: submitted, color: "bg-purple-500" },
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
            {isCoordinator
              ? "Key Coordinator Dashboard — Assign and oversee cases"
              : "Admin Dashboard — Manage your assigned cases"}
          </p>
        </div>
        {isCoordinator && (
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
            {isCoordinator ? "Recent Tickets" : "Active Cases"}
          </h2>
          <Link
            href="/admin/tickets"
            className="text-sm font-medium text-primary hover:underline"
          >
            View all
          </Link>
        </div>
        {recentTickets.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted">
            {isCoordinator
              ? "No tickets in the system yet."
              : "No cases assigned to you yet."}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-gray-50/50">
                <th className="px-6 py-3 text-left font-medium text-muted">Ref</th>
                <th className="px-6 py-3 text-left font-medium text-muted">Client</th>
                <th className="px-6 py-3 text-left font-medium text-muted">Status</th>
                <th className="px-6 py-3 text-left font-medium text-muted">
                  {isCoordinator ? "Assigned To" : "Created By"}
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
                        STATUS_COLORS[ticket.status] || "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {ticket.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-muted">
                    {isCoordinator
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
        )}
      </div>
    </div>
  );
}
