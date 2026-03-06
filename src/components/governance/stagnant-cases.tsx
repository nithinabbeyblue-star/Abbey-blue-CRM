"use client";

import { useState } from "react";
import Link from "next/link";
import { STATUS_CONFIG } from "@/components/ui/status-badge";

interface StagnantTicket {
  id: string;
  refNumber: string;
  clientName: string;
  status: string;
  updatedAt: string;
  assignedTo: { id: string; name: string } | null;
  createdBy: { name: string };
}

export function StagnantCases({ tickets }: { tickets: StagnantTicket[] }) {
  const [nudging, setNudging] = useState<string | null>(null);
  const [nudged, setNudged] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState({ text: "", type: "" });

  async function handleNudge(ticketId: string, assignedToId: string) {
    setNudging(ticketId);
    setMessage({ text: "", type: "" });

    try {
      const res = await fetch("/api/governance/stagnant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId, assignedToId }),
      });

      if (res.ok) {
        setNudged((prev) => new Set(prev).add(ticketId));
        setMessage({ text: "Nudge sent successfully", type: "success" });
      } else {
        const data = await res.json();
        setMessage({ text: data.error || "Failed to send nudge", type: "error" });
      }
    } catch {
      setMessage({ text: "Failed to send nudge", type: "error" });
    }

    setNudging(null);
  }

  function daysSince(dateStr: string): number {
    return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
  }

  if (tickets.length === 0) {
    return (
      <div className="mt-8 rounded-xl border border-green-200 bg-green-50 p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
            <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="font-medium text-green-800">All cases are up to date</p>
            <p className="text-sm text-green-600">No tickets have been stagnant for more than 5 days.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8 rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Stagnant Cases</h2>
          <p className="text-xs text-muted">Tickets not updated for 5+ days</p>
        </div>
        <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
          {tickets.length} case{tickets.length !== 1 ? "s" : ""}
        </span>
      </div>

      {message.text && (
        <div className={`mx-6 mt-3 rounded-lg px-3 py-2 text-xs ${
          message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
        }`}>
          {message.text}
        </div>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-gray-50/50">
            <th className="px-6 py-3 text-left font-medium text-muted">Ref</th>
            <th className="px-6 py-3 text-left font-medium text-muted">Client</th>
            <th className="px-6 py-3 text-left font-medium text-muted">Status</th>
            <th className="px-6 py-3 text-left font-medium text-muted">Assigned To</th>
            <th className="px-6 py-3 text-left font-medium text-muted">Last Updated</th>
            <th className="px-6 py-3 text-left font-medium text-muted">Action</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((ticket) => (
            <tr key={ticket.id} className="border-b border-border last:border-0 hover:bg-gray-50/50">
              <td className="px-6 py-3">
                <Link
                  href={`/super-admin/tickets/${ticket.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {ticket.refNumber}
                </Link>
              </td>
              <td className="px-6 py-3 text-foreground">{ticket.clientName}</td>
              <td className="px-6 py-3">
                <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${
                  STATUS_CONFIG[ticket.status]?.bg ?? "bg-gray-100"
                } ${STATUS_CONFIG[ticket.status]?.text ?? "text-gray-700"}`}>
                  {STATUS_CONFIG[ticket.status]?.label ?? ticket.status.replace(/_/g, " ")}
                </span>
              </td>
              <td className="px-6 py-3 text-muted">
                {ticket.assignedTo?.name || "Unassigned"}
              </td>
              <td className="px-6 py-3">
                <span className="text-xs text-red-600 font-medium">
                  {daysSince(ticket.updatedAt)} days ago
                </span>
              </td>
              <td className="px-6 py-3">
                {ticket.assignedTo ? (
                  nudged.has(ticket.id) ? (
                    <span className="text-xs text-green-600 font-medium">Nudged</span>
                  ) : (
                    <button
                      onClick={() => handleNudge(ticket.id, ticket.assignedTo!.id)}
                      disabled={nudging === ticket.id}
                      className="rounded border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-medium text-orange-700 hover:bg-orange-100 disabled:opacity-50"
                    >
                      {nudging === ticket.id ? "Sending..." : "Nudge"}
                    </button>
                  )
                ) : (
                  <span className="text-xs text-muted">No assignee</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
