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
  destination: string | null;
  status: string;
  source: string;
  priority: number;
  createdAt: string;
  createdBy: { id: string; name: string };
  assignedTo: { id: string; name: string } | null;
}

export default function SuperAdminTicketsPage() {
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
      <h1 className="text-2xl font-bold text-foreground">All Tickets</h1>
      <p className="mt-1 text-sm text-muted">System-wide ticket overview</p>

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

      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {loading ? (
          <div className="py-16 text-center text-sm text-muted">Loading...</div>
        ) : tickets.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted">No tickets found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-gray-50/50">
                <th className="px-4 py-3 text-left font-medium text-muted">Ref</th>
                <th className="px-4 py-3 text-left font-medium text-muted">Client</th>
                <th className="px-4 py-3 text-left font-medium text-muted">Case Type</th>
                <th className="px-4 py-3 text-left font-medium text-muted">Status</th>
                <th className="px-4 py-3 text-left font-medium text-muted">Source</th>
                <th className="px-4 py-3 text-left font-medium text-muted">Created By</th>
                <th className="px-4 py-3 text-left font-medium text-muted">Assigned To</th>
                <th className="px-4 py-3 text-left font-medium text-muted">Date</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id} className="border-b border-border last:border-0 hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <Link href={`/super-admin/tickets/${t.id}`} className="font-medium text-primary hover:underline">
                      {t.refNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{t.clientName}</div>
                    <div className="text-xs text-muted">{t.clientPhone}</div>
                  </td>
                  <td className="px-4 py-3">
                    <CaseBadge caseType={t.caseType} />
                    {t.destination && (
                      <p className="mt-0.5 text-xs text-muted">{t.destination}</p>
                    )}
                    {!t.caseType && !t.destination && <span className="text-muted">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">{t.source.replace(/_/g, " ")}</td>
                  <td className="px-4 py-3 text-muted">{t.createdBy?.name}</td>
                  <td className="px-4 py-3 text-muted">{t.assignedTo?.name || "Unassigned"}</td>
                  <td className="px-4 py-3 text-xs text-muted">
                    {new Date(t.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
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
