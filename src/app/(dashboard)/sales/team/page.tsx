import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { STATUS_CONFIG, ORDERED_STATUSES } from "@/components/ui/status-badge";

export default async function SalesTeamPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "SALES_MANAGER" && user.role !== "SUPER_ADMIN") {
    redirect("/sales");
  }

  // Get all active SALES users with their ticket counts
  const salesUsers = await db.user.findMany({
    where: { role: "SALES", status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      email: true,
      createdTickets: {
        select: { status: true, updatedAt: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const teamData = salesUsers.map((rep) => {
    const statusCounts: Record<string, number> = {};
    for (const s of ORDERED_STATUSES) {
      statusCounts[s] = 0;
    }
    let lastActivity: Date | null = null;

    for (const ticket of rep.createdTickets) {
      statusCounts[ticket.status] = (statusCounts[ticket.status] || 0) + 1;
      if (!lastActivity || ticket.updatedAt > lastActivity) {
        lastActivity = ticket.updatedAt;
      }
    }

    const approvedCount = statusCounts["APPROVED"] || 0;
    const totalCount = rep.createdTickets.length;
    const conversionRate = totalCount > 0 ? Math.round((approvedCount / totalCount) * 100) : 0;

    return {
      id: rep.id,
      name: rep.name,
      email: rep.email,
      total: totalCount,
      statusCounts,
      conversionRate,
      lastActivity,
    };
  });

  const totalCreated = teamData.reduce((sum, m) => sum + m.total, 0);

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Sales Team Progress</h1>
      <p className="mt-1 text-sm text-muted">
        Overview of all Sales team members and their ticket performance
      </p>

      {/* Summary Cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-medium text-muted">Team Members</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{teamData.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-medium text-muted">Total Tickets Created</p>
          <p className="mt-1 text-2xl font-bold text-blue-600">{totalCreated}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-medium text-muted">Avg Conversion Rate</p>
          <p className="mt-1 text-2xl font-bold text-green-600">
            {teamData.length > 0
              ? Math.round(teamData.reduce((sum, m) => sum + m.conversionRate, 0) / teamData.length)
              : 0}%
          </p>
        </div>
      </div>

      {/* Team Table */}
      <div className="mt-8 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {teamData.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted">
            No active Sales team members found.
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
                  <th className="px-4 py-3 text-center font-medium text-muted">Conv. %</th>
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
                    <td className="px-4 py-3 text-center">
                      <span className={`font-medium ${member.conversionRate >= 50 ? "text-green-600" : member.conversionRate >= 25 ? "text-yellow-600" : "text-muted"}`}>
                        {member.conversionRate}%
                      </span>
                    </td>
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
