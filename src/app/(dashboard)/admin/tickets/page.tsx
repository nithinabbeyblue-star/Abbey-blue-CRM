"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StatusBadge, ORDERED_STATUSES } from "@/components/ui/status-badge";
import { CaseBadge } from "@/components/ui/case-badge";

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

const PRIORITY_LABELS: Record<number, { label: string; color: string }> = {
  0: { label: "Normal", color: "text-muted" },
  1: { label: "High", color: "text-warning" },
  2: { label: "Urgent", color: "text-danger" },
};

export default function AdminTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    async function fetchTickets() {
      const url = filter ? `/api/tickets?status=${filter}` : "/api/tickets";
      const res = await fetch(url);
      const data = await res.json();
      setTickets(data.tickets || []);
      setLoading(false);
    }
    setLoading(true);
    fetchTickets();
  }, [filter]);

  const statuses = ["", ...ORDERED_STATUSES];

  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold text-foreground">Team Cases</h1>
        <p className="mt-1 text-sm text-muted">
          All cases across the admin department
        </p>
      </div>

      {/* Status Filters */}
      <div className="mt-6 flex flex-wrap gap-2">
        {statuses.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === s
                ? "bg-primary text-white"
                : "bg-white text-muted border border-border hover:bg-gray-50"
            }`}
          >
            {s ? s.replace(/_/g, " ") : "All"}
          </button>
        ))}
      </div>

      {/* Tickets Table */}
      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {loading ? (
          <div className="py-16 text-center text-sm text-muted">
            Loading cases...
          </div>
        ) : tickets.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted">
            No cases found.
          </div>
        ) : (
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
                      href={`/admin/tickets/${ticket.id}`}
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
        )}
      </div>
    </div>
  );
}
