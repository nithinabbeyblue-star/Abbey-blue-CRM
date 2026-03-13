import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";
import { Role, TicketStatus } from "@/generated/prisma/enums";
import { QuickStatusTable } from "@/components/tickets/quick-status-table";

export default async function AdminDashboard() {
  const user = await getCurrentUser();
  if (!user) return null;

  const isManager = user.role === Role.ADMIN_MANAGER || user.role === Role.SUPER_ADMIN;

  // Admin Manager sees all tickets, Admin sees only assigned
  const where = isManager ? {} : { assignedToId: user.userId };
  const activeWhere = { ...where, status: { notIn: [TicketStatus.APPROVED, TicketStatus.REJECTED] } };

  const [total, unassigned, docCollection, submitted, inProgress, onHold, oldestCase, recentTickets] =
    await Promise.all([
      db.ticket.count({ where: activeWhere }),
      db.ticket.count({ where: { assignedToId: null, status: { notIn: [TicketStatus.APPROVED, TicketStatus.REJECTED] } } }),
      db.ticket.count({ where: { ...where, status: "DOC_COLLECTION" } }),
      db.ticket.count({ where: { ...where, status: "SUBMITTED" } }),
      db.ticket.count({ where: { ...where, status: "IN_PROGRESS" } }),
      db.ticket.count({ where: { ...where, status: "ON_HOLD" } }),
      db.ticket.findFirst({
        where: activeWhere,
        orderBy: { createdAt: "asc" },
        select: { refNumber: true, createdAt: true },
      }),
      db.ticket.findMany({
        where: activeWhere,
        orderBy: { updatedAt: "desc" },
        take: 10,
        include: {
          createdBy: { select: { name: true } },
          assignedTo: { select: { name: true } },
        },
      }),
    ]);

  const oldestDays = oldestCase
    ? Math.floor((Date.now() - new Date(oldestCase.createdAt).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const stats = isManager
    ? [
        { label: "Active Cases", value: total, color: "bg-blue-500", sub: "" },
        { label: "Unassigned", value: unassigned, color: "bg-red-500", sub: "" },
        { label: "Doc Collection", value: docCollection, color: "bg-yellow-500", sub: "" },
        { label: "Submitted", value: submitted, color: "bg-purple-500", sub: "" },
        { label: "In Progress", value: inProgress, color: "bg-blue-400", sub: "Currently being worked on" },
        { label: "On Hold", value: onHold, color: "bg-orange-400", sub: "Awaiting action or response" },
        { label: "Oldest Case", value: oldestCase ? `${oldestDays}d` : "—", color: "bg-red-400", sub: oldestCase ? oldestCase.refNumber : "No active cases" },
      ]
    : [
        { label: "Active Cases", value: total, color: "bg-blue-500", sub: "" },
        { label: "Doc Collection", value: docCollection, color: "bg-yellow-500", sub: "" },
        { label: "Submitted", value: submitted, color: "bg-purple-500", sub: "" },
        { label: "In Progress", value: inProgress, color: "bg-blue-400", sub: "Currently being worked on" },
        { label: "On Hold", value: onHold, color: "bg-orange-400", sub: "Awaiting action or response" },
        { label: "Oldest Case", value: oldestCase ? `${oldestDays}d` : "—", color: "bg-red-400", sub: oldestCase ? oldestCase.refNumber : "No active cases" },
      ];

  // Serialize tickets for client component
  const serializedTickets = recentTickets.map((t) => ({
    id: t.id,
    refNumber: t.refNumber,
    clientName: t.clientName,
    clientPhone: t.clientPhone,
    status: t.status,
    createdBy: { name: t.createdBy.name },
    assignedTo: t.assignedTo ? { name: t.assignedTo.name } : null,
    updatedAt: t.updatedAt.toISOString(),
  }));

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
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col justify-between rounded-xl border border-border bg-card p-6 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted">{stat.label}</p>
              <div className={`h-3 w-3 rounded-full ${stat.color}`} />
            </div>
            <p className="mt-2 text-3xl font-bold text-foreground">
              {stat.value}
            </p>
            <p className="mt-1 text-xs text-muted">{stat.sub || "\u00A0"}</p>
          </div>
        ))}
      </div>

      {/* Recent Cases with Quick Status Update */}
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
        <QuickStatusTable
          tickets={serializedTickets}
          isManager={isManager}
          basePath="/admin"
        />
      </div>
    </div>
  );
}
