"use client";

import { useEffect, useState, useCallback } from "react";

interface AuditLog {
  id: string;
  action: string;
  oldValue: string | null;
  newValue: string | null;
  metadata: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  user: { name: string; email: string };
  ticket: { refNumber: string } | null;
}

interface UserOption {
  id: string;
  name: string;
  email: string;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [filterUser, setFilterUser] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", "50");
    if (filterUser) params.set("userId", filterUser);
    if (filterAction) params.set("action", filterAction);
    if (filterFrom) params.set("from", filterFrom);
    if (filterTo) params.set("to", filterTo);

    const res = await fetch(`/api/analytics/audit-logs?${params}`);
    if (res.ok) {
      const data = await res.json();
      setLogs(data.logs || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    }
    setLoading(false);
  }, [page, filterUser, filterAction, filterFrom, filterTo]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Fetch users for filter dropdown
  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((d) =>
        setUsers(
          (d.users || []).map((u: { id: string; name: string; email: string }) => ({
            id: u.id,
            name: u.name,
            email: u.email,
          }))
        )
      );
  }, []);

  function formatTimestamp(iso: string) {
    return new Date(iso).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold text-foreground">System Transparency</h1>
        <p className="mt-1 text-sm text-muted">
          Complete audit trail of all CRM interactions ({total} entries)
        </p>
      </div>

      {/* Filter Bar */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <select
          value={filterUser}
          onChange={(e) => { setFilterUser(e.target.value); setPage(1); }}
          className="rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
        >
          <option value="">All Users</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Filter by action..."
          value={filterAction}
          onChange={(e) => { setFilterAction(e.target.value); setPage(1); }}
          className="rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <input
          type="date"
          value={filterFrom}
          onChange={(e) => { setFilterFrom(e.target.value); setPage(1); }}
          className="rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <input
          type="date"
          value={filterTo}
          onChange={(e) => { setFilterTo(e.target.value); setPage(1); }}
          className="rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <button
          onClick={() => { setFilterUser(""); setFilterAction(""); setFilterFrom(""); setFilterTo(""); setPage(1); }}
          className="rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-muted hover:bg-gray-50"
        >
          Clear Filters
        </button>
      </div>

      {/* Logs Table */}
      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {loading ? (
          <div className="py-12 text-center text-sm text-muted">Loading audit logs...</div>
        ) : logs.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted">No audit logs found matching your filters.</div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-gray-50/50">
                <th className="px-4 py-3 text-left font-medium text-muted">Timestamp</th>
                <th className="px-4 py-3 text-left font-medium text-muted">User</th>
                <th className="px-4 py-3 text-left font-medium text-muted">Action</th>
                <th className="px-4 py-3 text-left font-medium text-muted">Details</th>
                <th className="px-4 py-3 text-left font-medium text-muted">Ticket</th>
                <th className="px-4 py-3 text-left font-medium text-muted">IP / Device</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-border last:border-0 hover:bg-gray-50/50">
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">
                    {formatTimestamp(log.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs font-medium text-foreground">{log.user.name}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-block rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                      {log.action}
                    </span>
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-xs text-muted">
                    {log.oldValue && log.newValue
                      ? `${log.oldValue} → ${log.newValue}`
                      : log.newValue || log.oldValue || "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">
                    {log.ticket?.refNumber || "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">
                    <div>{log.ipAddress || "—"}</div>
                    {log.userAgent && (
                      <div className="text-[10px] text-muted/60">{log.userAgent}</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-muted">
            Page {page} of {totalPages} ({total} total)
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="rounded border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-gray-50 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className="rounded border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
