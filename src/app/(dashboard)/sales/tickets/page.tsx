"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StatusBadge, ORDERED_STATUSES, STATUS_CONFIG } from "@/components/ui/status-badge";
import { CaseBadge } from "@/components/ui/case-badge";
import { CASE_CONFIG } from "@/constants/cases";

interface Ticket {
  id: string;
  refNumber: string;
  clientName: string;
  clientPhone: string;
  caseType: string | null;
  status: string;
  source: string;
  priority: number;
  createdAt: string;
  createdBy: { id: string; name: string };
  assignedTo: { id: string; name: string } | null;
}

interface StaffMember {
  id: string;
  name: string;
}

const PRIORITY_LABELS: Record<number, { label: string; color: string }> = {
  0: { label: "Normal", color: "text-muted" },
  1: { label: "High", color: "text-warning" },
  2: { label: "Urgent", color: "text-danger" },
};

export default function SalesTeamCasesPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [staffFilter, setStaffFilter] = useState("");
  const [caseTypeFilter, setCaseTypeFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [staffList, setStaffList] = useState<StaffMember[]>([]);

  // Fetch staff list for dropdown
  useEffect(() => {
    fetch("/api/users/sales")
      .then((res) => res.json())
      .then((data) => setStaffList(data.salesUsers || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    async function fetchTickets() {
      const params = new URLSearchParams();
      if (filter) params.set("status", filter);
      if (staffFilter) params.set("staffId", staffFilter);
      if (caseTypeFilter) params.set("caseType", caseTypeFilter);
      if (priorityFilter) params.set("priority", priorityFilter);
      const url = `/api/tickets${params.toString() ? `?${params}` : ""}`;
      const res = await fetch(url);
      const data = await res.json();
      setTickets(data.tickets || []);
      setLoading(false);
    }
    setLoading(true);
    fetchTickets();
  }, [filter, staffFilter, caseTypeFilter, priorityFilter]);

  const statuses = ["", ...ORDERED_STATUSES];
  const caseTypes = Object.entries(CASE_CONFIG);

  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold text-foreground">Team Cases</h1>
        <p className="mt-1 text-sm text-muted">
          All cases created by the sales team
        </p>
      </div>

      {/* Filter Dropdowns */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <select
          value={staffFilter}
          onChange={(e) => setStaffFilter(e.target.value)}
          className="rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        >
          <option value="">All Staff</option>
          {staffList.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        <select
          value={caseTypeFilter}
          onChange={(e) => setCaseTypeFilter(e.target.value)}
          className="rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        >
          <option value="">All Case Types</option>
          {caseTypes.map(([key, config]) => (
            <option key={key} value={key}>{config.label}</option>
          ))}
        </select>

        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        >
          <option value="">All Priorities</option>
          <option value="0">Normal</option>
          <option value="1">High</option>
          <option value="2">Urgent</option>
        </select>

        {(staffFilter || caseTypeFilter || priorityFilter) && (
          <button
            onClick={() => { setStaffFilter(""); setCaseTypeFilter(""); setPriorityFilter(""); }}
            className="text-xs font-medium text-primary hover:underline"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Status Filters */}
      <div className="mt-4 flex flex-wrap gap-2">
        {statuses.map((s) => {
          const cfg = s ? STATUS_CONFIG[s] : null;
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === s
                  ? cfg
                    ? `${cfg.bg} ${cfg.text} ring-2 ring-offset-1 ring-current`
                    : "bg-primary text-white"
                  : cfg
                    ? `${cfg.bg} ${cfg.text} opacity-70 hover:opacity-100`
                    : "bg-white text-muted border border-border hover:bg-gray-50"
              }`}
            >
              {s ? (cfg?.label || s.replace(/_/g, " ")) : "All"}
            </button>
          );
        })}
      </div>

      {/* Tickets Table */}
      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {loading ? (
          <div className="py-16 text-center text-sm text-muted">
            Loading cases...
          </div>
        ) : tickets.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-muted">No cases found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-gray-50/50">
                <th className="px-4 py-3 text-left font-medium text-muted">Ref</th>
                <th className="px-4 py-3 text-left font-medium text-muted">Client</th>
                <th className="px-4 py-3 text-left font-medium text-muted">Case Type</th>
                <th className="px-4 py-3 text-left font-medium text-muted">Status</th>
                <th className="px-4 py-3 text-left font-medium text-muted">Priority</th>
                <th className="px-4 py-3 text-left font-medium text-muted">Assigned To</th>
                <th className="px-4 py-3 text-left font-medium text-muted">Created By</th>
                <th className="px-4 py-3 text-left font-medium text-muted">Created</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket) => (
                <tr
                  key={ticket.id}
                  className="border-b border-border last:border-0 hover:bg-gray-50/50"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/sales/tickets/${ticket.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {ticket.refNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{ticket.clientName}</div>
                    <div className="text-xs text-muted">{ticket.clientPhone}</div>
                  </td>
                  <td className="px-4 py-3">
                    <CaseBadge caseType={ticket.caseType} />
                    {!ticket.caseType && <span className="text-muted">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={ticket.status} />
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium ${PRIORITY_LABELS[ticket.priority]?.color || "text-muted"}`}>
                      {PRIORITY_LABELS[ticket.priority]?.label || "Normal"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {ticket.assignedTo?.name || (
                      <span className="text-xs text-amber-600 font-medium">Unassigned</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted">{ticket.createdBy?.name}</td>
                  <td className="px-4 py-3 text-xs text-muted">
                    {new Date(ticket.createdAt).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
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
