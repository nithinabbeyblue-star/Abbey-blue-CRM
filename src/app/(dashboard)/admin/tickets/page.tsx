"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Ticket {
  id: string;
  refNumber: string;
  clientName: string;
  clientPhone: string;
  visaType: string | null;
  destination: string | null;
  status: string;
  source: string;
  priority: number;
  createdAt: string;
  createdBy: { id: string; name: string };
  assignedTo: { id: string; name: string } | null;
}

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

  const statuses = [
    "",
    "NEW",
    "CONTACTED",
    "DOCS_PENDING",
    "DOCS_RECEIVED",
    "SUBMITTED",
    "APPROVED",
    "REJECTED",
    "ON_HOLD",
  ];

  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold text-foreground">All Tickets</h1>
        <p className="mt-1 text-sm text-muted">
          Manage your assigned cases
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
            Loading tickets...
          </div>
        ) : tickets.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted">
            No tickets found.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-gray-50/50">
                <th className="px-4 py-3 text-left font-medium text-muted">Ref</th>
                <th className="px-4 py-3 text-left font-medium text-muted">Client</th>
                <th className="px-4 py-3 text-left font-medium text-muted">Visa / Destination</th>
                <th className="px-4 py-3 text-left font-medium text-muted">Status</th>
                <th className="px-4 py-3 text-left font-medium text-muted">Priority</th>
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
                  <td className="px-4 py-3 text-muted">
                    {ticket.visaType || "—"}
                    {ticket.destination && ` / ${ticket.destination}`}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${
                        STATUS_COLORS[ticket.status] || "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {ticket.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium ${PRIORITY_LABELS[ticket.priority]?.color || "text-muted"}`}>
                      {PRIORITY_LABELS[ticket.priority]?.label || "Normal"}
                    </span>
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
