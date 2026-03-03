"use client";

import { useEffect, useState } from "react";
import { STATUS_CONFIG } from "@/components/ui/status-badge";
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

interface AdminUser {
  id: string;
  name: string;
  email: string;
}

const PRIORITY_BADGE: Record<number, string> = {
  0: "",
  1: "border-l-4 border-l-warning",
  2: "border-l-4 border-l-danger",
};

export default function AssignmentsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [message, setMessage] = useState({ text: "", type: "" });
  const [canAssign, setCanAssign] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const [ticketsRes, adminsRes, meRes] = await Promise.all([
          fetch("/api/tickets"),
          fetch("/api/users/admins"),
          fetch("/api/auth/me"),
        ]);

        if (!ticketsRes.ok || !adminsRes.ok) {
          const errMsg = !ticketsRes.ok
            ? `Failed to load tickets (${ticketsRes.status})`
            : `Failed to load admin users (${adminsRes.status})`;
          setMessage({ text: errMsg, type: "error" });
          setLoading(false);
          return;
        }

        const ticketsData = await ticketsRes.json();
        const adminsData = await adminsRes.json();
        setTickets(ticketsData.tickets || []);
        setAdmins(adminsData.admins || []);

        if (meRes.ok) {
          const meData = await meRes.json();
          const role = meData.user?.role;
          setCanAssign(role === "KEY_COORDINATOR" || role === "SUPER_ADMIN");
        }
      } catch {
        setMessage({ text: "Failed to load data. Please refresh.", type: "error" });
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  async function handleAssign(ticketId: string, adminId: string) {
    setAssigning(ticketId);
    setMessage({ text: "", type: "" });

    const res = await fetch(`/api/tickets/${ticketId}/assign`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignedToId: adminId }),
    });

    if (res.ok) {
      // Update ticket in local state
      const adminUser = admins.find((a) => a.id === adminId);
      setTickets((prev) =>
        prev.map((t) =>
          t.id === ticketId
            ? { ...t, assignedTo: adminUser ? { id: adminUser.id, name: adminUser.name } : null }
            : t
        )
      );
      setMessage({ text: "Ticket assigned successfully", type: "success" });
    } else {
      const data = await res.json();
      setMessage({ text: data.error || "Failed to assign", type: "error" });
    }
    setAssigning(null);
  }

  if (loading) {
    return <div className="py-16 text-center text-sm text-muted">Loading...</div>;
  }

  const unassigned = tickets.filter((t) => !t.assignedTo);
  const assigned = tickets.filter((t) => t.assignedTo);

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Ticket Assignments</h1>
      <p className="mt-1 text-sm text-muted">
        Assign incoming tickets to Admin team members
      </p>

      {/* Message */}
      {message.text && (
        <div
          className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
            message.type === "success"
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      {admins.length === 0 && (
        <div className="mt-4 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-700">
          No Admin team members found. Ask the Super Admin to create Admin users first.
        </div>
      )}

      {/* Unassigned Tickets */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-foreground">
          Unassigned Tickets ({unassigned.length})
        </h2>
        {unassigned.length === 0 ? (
          <div className="mt-4 rounded-xl border border-border bg-card py-12 text-center text-sm text-muted shadow-sm">
            All tickets have been assigned!
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {unassigned.map((ticket) => (
              <div
                key={ticket.id}
                className={`rounded-xl border border-border bg-card p-5 shadow-sm ${PRIORITY_BADGE[ticket.priority] || ""}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-primary">{ticket.refNumber}</span>
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          STATUS_CONFIG[ticket.status]?.bg ?? "bg-gray-100"
                        } ${STATUS_CONFIG[ticket.status]?.text ?? "text-gray-700"}`}
                      >
                        {STATUS_CONFIG[ticket.status]?.label ?? ticket.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-medium text-foreground">
                      {ticket.clientName} &mdash; {ticket.clientPhone}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      <CaseBadge caseType={ticket.caseType} />
                      {!ticket.caseType && "No case type"}
                      {ticket.destination && ` / ${ticket.destination}`}
                      {" "}&bull;{" "}Source: {ticket.source.replace(/_/g, " ")}
                      {" "}&bull;{" "}By: {ticket.createdBy.name}
                    </p>
                  </div>

                  {/* Assign dropdown — only for KEY_COORDINATOR / SUPER_ADMIN */}
                  {canAssign && (
                    <div className="flex items-center gap-2">
                      <select
                        id={`assign-${ticket.id}`}
                        defaultValue=""
                        disabled={assigning === ticket.id || admins.length === 0}
                        onChange={(e) => {
                          if (e.target.value) handleAssign(ticket.id, e.target.value);
                        }}
                        className="rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary disabled:opacity-50"
                      >
                        <option value="" disabled>
                          {assigning === ticket.id ? "Assigning..." : "Assign to..."}
                        </option>
                        {admins.map((admin) => (
                          <option key={admin.id} value={admin.id}>
                            {admin.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Assigned Tickets */}
      <div className="mt-10">
        <h2 className="text-lg font-semibold text-foreground">
          Assigned Tickets ({assigned.length})
        </h2>
        {assigned.length === 0 ? (
          <div className="mt-4 rounded-xl border border-border bg-card py-12 text-center text-sm text-muted shadow-sm">
            No assigned tickets yet.
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-gray-50/50">
                  <th className="px-4 py-3 text-left font-medium text-muted">Ref</th>
                  <th className="px-4 py-3 text-left font-medium text-muted">Client</th>
                  <th className="px-4 py-3 text-left font-medium text-muted">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-muted">Assigned To</th>
                  {canAssign && <th className="px-4 py-3 text-left font-medium text-muted">Reassign</th>}
                </tr>
              </thead>
              <tbody>
                {assigned.map((ticket) => (
                  <tr key={ticket.id} className="border-b border-border last:border-0 hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-medium text-primary">{ticket.refNumber}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{ticket.clientName}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          STATUS_CONFIG[ticket.status]?.bg ?? "bg-gray-100"
                        } ${STATUS_CONFIG[ticket.status]?.text ?? "text-gray-700"}`}
                      >
                        {STATUS_CONFIG[ticket.status]?.label ?? ticket.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-foreground">{ticket.assignedTo?.name}</td>
                    {canAssign && (
                      <td className="px-4 py-3">
                        <select
                          defaultValue={ticket.assignedTo?.id || ""}
                          disabled={assigning === ticket.id}
                          onChange={(e) => {
                            if (e.target.value && e.target.value !== ticket.assignedTo?.id) {
                              handleAssign(ticket.id, e.target.value);
                            }
                          }}
                          className="rounded border border-border bg-white px-2 py-1 text-xs outline-none focus:border-primary disabled:opacity-50"
                        >
                          {admins.map((admin) => (
                            <option key={admin.id} value={admin.id}>
                              {admin.name}
                            </option>
                          ))}
                        </select>
                      </td>
                    )}
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
