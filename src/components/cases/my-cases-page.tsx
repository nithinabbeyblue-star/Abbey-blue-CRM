"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { StatusBadge, STATUS_CONFIG } from "@/components/ui/status-badge";

interface Ticket {
  id: string;
  refNumber: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string | null;
  status: string;
  priority: number;
  updatedAt: string;
  createdAt: string;
  createdBy: { id: string; name: string };
  assignedTo: { id: string; name: string } | null;
}

interface StatusCount {
  status: string;
  count: number;
}

const PRIORITY_LABELS: Record<number, { label: string; color: string }> = {
  0: { label: "Normal", color: "text-muted" },
  1: { label: "High", color: "text-orange-600" },
  2: { label: "Urgent", color: "text-red-600 font-bold" },
};

const SORT_OPTIONS = [
  { value: "recent", label: "Recently Modified" },
  { value: "alpha", label: "Client Name (A-Z)" },
  { value: "status", label: "Status" },
  { value: "oldest", label: "Oldest First" },
];

export function MyCasesPage({
  basePath,
  roleLabel,
}: {
  basePath: string; // e.g. "/admin/tickets", "/sales/tickets"
  roleLabel: string;
}) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [statusCounts, setStatusCounts] = useState<StatusCount[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState("recent");
  const [statusFilter, setStatusFilter] = useState("");

  const fetchCases = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ sort });
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/my-cases?${params}`);
      if (res.ok) {
        const data = await res.json();
        setTickets(data.tickets);
        setStatusCounts(data.statusCounts);
        setTotal(data.total);
      }
    } catch {
      // silently fail
    }
    setLoading(false);
  }, [sort, statusFilter]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  const allCount = statusCounts.reduce((sum, s) => sum + s.count, 0);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Cases</h1>
          <p className="mt-1 text-sm text-muted">
            {roleLabel} — {total} case{total !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Sort Dropdown */}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Status Filter Tabs */}
      <div className="mt-6 flex flex-wrap gap-2">
        <button
          onClick={() => setStatusFilter("")}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            !statusFilter
              ? "bg-primary text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          All ({allCount})
        </button>
        {statusCounts.map((sc) => (
          <button
            key={sc.status}
            onClick={() => setStatusFilter(statusFilter === sc.status ? "" : sc.status)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              statusFilter === sc.status
                ? "bg-primary text-white"
                : `${STATUS_CONFIG[sc.status]?.bg ?? "bg-gray-100"} ${STATUS_CONFIG[sc.status]?.text ?? "text-gray-600"} hover:opacity-80`
            }`}
          >
            {STATUS_CONFIG[sc.status]?.label ?? sc.status.replace(/_/g, " ")} ({sc.count})
          </button>
        ))}
      </div>

      {/* Cases Table */}
      <div className="mt-4 rounded-xl border border-border bg-card shadow-sm">
        {loading ? (
          <div className="py-16 text-center text-sm text-muted">Loading cases...</div>
        ) : tickets.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted">
            {statusFilter ? "No cases with this status." : "No cases found."}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-gray-50/50">
                <th className="px-5 py-3 text-left font-medium text-muted">Ref</th>
                <th className="px-5 py-3 text-left font-medium text-muted">Client</th>
                <th className="px-5 py-3 text-left font-medium text-muted">Status</th>
                <th className="px-5 py-3 text-left font-medium text-muted">Priority</th>
                <th className="px-5 py-3 text-left font-medium text-muted">Assigned To</th>
                <th className="px-5 py-3 text-left font-medium text-muted">Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket) => {
                const pri = PRIORITY_LABELS[ticket.priority] || PRIORITY_LABELS[0];
                return (
                  <tr
                    key={ticket.id}
                    className="border-b border-border last:border-0 hover:bg-gray-50/50"
                  >
                    <td className="px-5 py-3">
                      <Link
                        href={`${basePath}/${ticket.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {ticket.refNumber}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <div className="font-medium text-foreground">{ticket.clientName}</div>
                      <div className="text-xs text-muted">{ticket.clientPhone}</div>
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={ticket.status} />
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs ${pri.color}`}>{pri.label}</span>
                    </td>
                    <td className="px-5 py-3 text-muted">
                      {ticket.assignedTo?.name || "Unassigned"}
                    </td>
                    <td className="px-5 py-3 text-xs text-muted">
                      {new Date(ticket.updatedAt).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
