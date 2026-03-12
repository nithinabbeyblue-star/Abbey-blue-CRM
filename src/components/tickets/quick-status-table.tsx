"use client";

import { useState } from "react";
import Link from "next/link";
import { STATUS_CONFIG, ORDERED_STATUSES, getStatusLabel } from "@/components/ui/status-badge";

interface TicketRow {
  id: string;
  refNumber: string;
  clientName: string;
  clientPhone: string;
  status: string;
  createdBy: { name: string };
  assignedTo: { name: string } | null;
  updatedAt: string;
}

interface QuickStatusTableProps {
  tickets: TicketRow[];
  isManager: boolean;
  basePath: string;
}

export function QuickStatusTable({ tickets, isManager, basePath }: QuickStatusTableProps) {
  const [rows, setRows] = useState(tickets);
  const [updating, setUpdating] = useState<string | null>(null);

  async function handleStatusChange(ticketId: string, newStatus: string) {
    setUpdating(ticketId);
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setRows((prev) =>
          prev.map((t) => (t.id === ticketId ? { ...t, status: newStatus } : t))
        );
      }
    } catch {
      // silent
    }
    setUpdating(null);
  }

  if (rows.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted">
        {isManager ? "No tickets in the system yet." : "No cases assigned to you yet."}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
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
          {rows.map((ticket) => (
            <tr
              key={ticket.id}
              className="border-b border-border last:border-0 hover:bg-gray-50/50"
            >
              <td className="px-6 py-3">
                <Link
                  href={`${basePath}/tickets/${ticket.id}`}
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
                <select
                  value={ticket.status}
                  onChange={(e) => handleStatusChange(ticket.id, e.target.value)}
                  disabled={updating === ticket.id}
                  className={`rounded-full border-0 py-1 pl-2.5 pr-7 text-xs font-medium outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50 ${
                    STATUS_CONFIG[ticket.status]?.bg ?? "bg-gray-100"
                  } ${STATUS_CONFIG[ticket.status]?.text ?? "text-gray-700"}`}
                >
                  {ORDERED_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {getStatusLabel(s)}
                    </option>
                  ))}
                </select>
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
    </div>
  );
}
