import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { STATUS_CONFIG, ORDERED_STATUSES } from "@/components/ui/status-badge";

export default async function AdminTeamPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN_MANAGER" && user.role !== "SUPER_ADMIN") {
    redirect("/admin");
  }

  // Get all active ADMIN users with their ticket counts
  const adminUsers = await db.user.findMany({
    where: { role: "ADMIN", status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      email: true,
      assignedTickets: {
        select: { status: true, updatedAt: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const teamData = adminUsers.map((admin) => {
    const statusCounts: Record<string, number> = {};
    for (const s of ORDERED_STATUSES) {
      statusCounts[s] = 0;
    }
    let lastActivity: Date | null = null;

    for (const ticket of admin.assignedTickets) {
      statusCounts[ticket.status] = (statusCounts[ticket.status] || 0) + 1;
      if (!lastActivity || ticket.updatedAt > lastActivity) {
        lastActivity = ticket.updatedAt;
      }
    }

    return {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      total: admin.assignedTickets.length,
      statusCounts,
      lastActivity,
    };
  });

  // Summary stats
  const totalAssigned = teamData.reduce((sum, m) => sum + m.total, 0);
  const unassignedCount = await db.ticket.count({ where: { assignedToId: null } });

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Admin Team Progress</h1>
      <p className="mt-1 text-sm text-muted">
        Overview of all Admin team members and their case workload
      </p>

      {/* Summary Cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-medium text-muted">Team Members</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{teamData.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-medium text-muted">Total Assigned</p>
          <p className="mt-1 text-2xl font-bold text-blue-600">{totalAssigned}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-medium text-muted">Unassigned (Queue)</p>
          <p className="mt-1 text-2xl font-bold text-red-600">{unassignedCount}</p>
        </div>
      </div>

      {/* Team Table */}
      <div className="mt-8 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {teamData.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted">
            No active Admin team members found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-gray-50/50">
                  <th className="px-4 py-3 text-left font-medium text-muted">Name</th>
                  <th className="px-4 py-3 text-center font-medium text-muted">Total</th>
                  {ORDERED_STATUSES.map((s) => (
                    <th key={s} className="px-3 py-3 text-center font-medium text-muted">
                      <span className="text-xs">{STATUS_CONFIG[s]?.label ?? s}</span>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-left font-medium text-muted">Last Activity</th>
                </tr>
              </thead>
              <tbody>
                {teamData.map((member) => (
                  <tr key={member.id} className="border-b border-border last:border-0 hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{member.name}</div>
                      <div className="text-xs text-muted">{member.email}</div>
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-foreground">{member.total}</td>
                    {ORDERED_STATUSES.map((s) => (
                      <td key={s} className="px-3 py-3 text-center">
                        {member.statusCounts[s] > 0 ? (
                          <span
                            className={`inline-block min-w-[24px] rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CONFIG[s]?.bg} ${STATUS_CONFIG[s]?.text}`}
                          >
                            {member.statusCounts[s]}
                          </span>
                        ) : (
                          <span className="text-xs text-muted">—</span>
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-xs text-muted">
                      {member.lastActivity
                        ? new Date(member.lastActivity).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })
                        : "—"}
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
