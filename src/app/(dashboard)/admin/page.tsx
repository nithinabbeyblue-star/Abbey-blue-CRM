import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";
import { Role } from "@/generated/prisma/enums";
import { STATUS_CONFIG } from "@/components/ui/status-badge";
import { calcVat, formatCurrency } from "@/constants/finance";

export default async function AdminDashboard() {
  const user = await getCurrentUser();
  if (!user) return null;

  const isManager = user.role === Role.ADMIN_MANAGER || user.role === Role.SUPER_ADMIN;

  // Admin Manager sees all tickets, Admin sees only assigned
  const where = isManager ? {} : { assignedToId: user.userId };

  const [total, unassigned, docCollection, submitted, approved, recentTickets, financials] =
    await Promise.all([
      db.ticket.count({ where }),
      db.ticket.count({ where: { assignedToId: null } }),
      db.ticket.count({
        where: { ...where, status: "DOC_COLLECTION" },
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
      isManager
        ? db.ticket.aggregate({
            _sum: { paidAmount: true, ablFee: true, adsFee: true },
          })
        : null,
    ]);

  // Financial Health calculations (Manager/SA only)
  const grossRevenue = financials?._sum.paidAmount ?? 0;
  const vatLiability = calcVat(financials?._sum.ablFee ?? 0);
  const totalAdsFees = financials?._sum.adsFee ?? 0;
  const netProfit = Math.round((grossRevenue - vatLiability - totalAdsFees) * 100) / 100;

  const stats = isManager
    ? [
        { label: "Total Tickets", value: total, color: "bg-blue-500" },
        { label: "Unassigned", value: unassigned, color: "bg-red-500" },
        { label: "Doc Collection", value: docCollection, color: "bg-yellow-500" },
        { label: "Approved", value: approved, color: "bg-emerald-500" },
      ]
    : [
        { label: "Assigned to Me", value: total, color: "bg-blue-500" },
        { label: "Doc Collection", value: docCollection, color: "bg-yellow-500" },
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

      {/* Executive Financial Summary — Manager/SA only */}
      {isManager && (
        <div className="mt-8 rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">
            Financial Health
          </h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div>
              <p className="text-xs font-medium text-muted">Gross Revenue</p>
              <p className="mt-1 text-2xl font-bold text-blue-600">
                {formatCurrency(grossRevenue)}
              </p>
              <p className="mt-0.5 text-xs text-muted">Total paid by clients</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted">Tax Liability (VAT 23%)</p>
              <p className="mt-1 text-2xl font-bold text-orange-600">
                {formatCurrency(vatLiability)}
              </p>
              <p className="mt-0.5 text-xs text-muted">To be set aside for Revenue</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted">Net Profit</p>
              <p className={`mt-1 text-2xl font-bold ${netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                {formatCurrency(netProfit)}
              </p>
              <p className="mt-0.5 text-xs text-muted">After VAT & ADS fees</p>
            </div>
          </div>
        </div>
      )}

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
            href="/admin/tickets"
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
        )}
      </div>
    </div>
  );
}
