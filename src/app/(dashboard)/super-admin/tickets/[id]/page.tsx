"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { DocumentSection } from "@/components/documents/document-section";
import { ChatPanel } from "@/components/chat/chat-panel";
import { StatusBadge, ORDERED_STATUSES, getStatusLabel } from "@/components/ui/status-badge";
import { CaseBadge } from "@/components/ui/case-badge";

interface AuditLog {
  id: string;
  action: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
  user: { id: string; name: string };
}

interface Ticket {
  id: string;
  refNumber: string;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string;
  nationality: string | null;
  caseType: string | null;
  destination: string | null;
  status: string;
  source: string;
  priority: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; name: string; email: string };
  assignedTo: { id: string; name: string; email: string } | null;
  auditLogs: AuditLog[];
}

interface AdminUser {
  id: string;
  name: string;
  email: string;
}

export default function SuperAdminTicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });
  const [currentUserId, setCurrentUserId] = useState("");

  const fetchTicket = useCallback(async () => {
    const [ticketRes, adminsRes, meRes] = await Promise.all([
      fetch(`/api/tickets/${id}`),
      fetch("/api/users/admins"),
      fetch("/api/auth/me"),
    ]);
    if (ticketRes.ok) {
      const data = await ticketRes.json();
      setTicket(data.ticket);
    }
    if (adminsRes.ok) {
      const data = await adminsRes.json();
      setAdmins(data.admins || []);
    }
    if (meRes.ok) {
      const meData = await meRes.json();
      setCurrentUserId(meData.user?.userId || "");
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchTicket(); }, [fetchTicket]);

  async function handleStatusChange(newStatus: string) {
    if (!ticket || newStatus === ticket.status) return;
    setUpdating(true);
    setMessage({ text: "", type: "" });
    const res = await fetch(`/api/tickets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      setMessage({ text: `Status updated to ${getStatusLabel(newStatus)}`, type: "success" });
      await fetchTicket();
    } else {
      const data = await res.json();
      setMessage({ text: data.error || "Failed", type: "error" });
    }
    setUpdating(false);
  }

  async function handleAssign(adminId: string) {
    setUpdating(true);
    setMessage({ text: "", type: "" });
    const res = await fetch(`/api/tickets/${id}/assign`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignedToId: adminId }),
    });
    if (res.ok) {
      setMessage({ text: "Ticket reassigned", type: "success" });
      await fetchTicket();
    } else {
      const data = await res.json();
      setMessage({ text: data.error || "Failed", type: "error" });
    }
    setUpdating(false);
  }

  if (loading) return <div className="py-16 text-center text-sm text-muted">Loading...</div>;
  if (!ticket) return (
    <div className="py-16 text-center">
      <p className="text-sm text-danger">Ticket not found</p>
      <Link href="/super-admin/tickets" className="mt-2 inline-block text-sm text-primary hover:underline">Back</Link>
    </div>
  );

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/super-admin/tickets" className="text-sm text-muted hover:text-primary">&larr; Back</Link>
          <h1 className="mt-2 text-2xl font-bold text-foreground">{ticket.refNumber}</h1>
          <p className="mt-1 text-sm text-muted">
            Created by {ticket.createdBy.name} on{" "}
            {new Date(ticket.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}
          </p>
        </div>
        <StatusBadge status={ticket.status} size="sm" />
      </div>

      {message.text && (
        <div className={`mt-4 rounded-lg border px-4 py-3 text-sm ${message.type === "success" ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}`}>
          {message.text}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          {/* Client Info */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">Client Information</h2>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div><dt className="text-xs font-medium text-muted">Name</dt><dd className="mt-1 font-medium">{ticket.clientName}</dd></div>
              <div><dt className="text-xs font-medium text-muted">Phone</dt><dd className="mt-1">{ticket.clientPhone}</dd></div>
              <div><dt className="text-xs font-medium text-muted">Email</dt><dd className="mt-1">{ticket.clientEmail || "—"}</dd></div>
              <div><dt className="text-xs font-medium text-muted">Nationality</dt><dd className="mt-1">{ticket.nationality || "—"}</dd></div>
              <div><dt className="text-xs font-medium text-muted">Case Type</dt><dd className="mt-1"><CaseBadge caseType={ticket.caseType} />{!ticket.caseType && "—"}</dd></div>
              <div><dt className="text-xs font-medium text-muted">Destination</dt><dd className="mt-1">{ticket.destination || "—"}</dd></div>
            </dl>
          </div>

          {/* Notes */}
          {ticket.notes && (
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted">Notes</h2>
              <p className="whitespace-pre-wrap text-sm">{ticket.notes}</p>
            </div>
          )}

          {/* Documents */}
          <DocumentSection ticketId={id} caseType={ticket.caseType} />

          {/* Audit Log */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">Case History</h2>
            {ticket.auditLogs.length === 0 ? (
              <p className="text-sm text-muted">No activity yet.</p>
            ) : (
              <div className="space-y-3">
                {ticket.auditLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
                    <div className="mt-0.5 h-2 w-2 rounded-full bg-primary" />
                    <div>
                      <p className="text-sm">
                        <span className="font-medium">{log.user.name}</span>{" "}
                        {log.action.replace(/_/g, " ").toLowerCase()}
                        {log.oldValue && log.newValue && <> from <span className="font-medium">{log.oldValue.replace(/_/g, " ")}</span> to <span className="font-medium">{log.newValue.replace(/_/g, " ")}</span></>}
                        {!log.oldValue && log.newValue && <> &mdash; <span className="font-medium">{log.newValue.replace(/_/g, " ")}</span></>}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        {new Date(log.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Assignment */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">Assignment</h2>
            <p className="mb-3 text-sm">
              Currently: <span className="font-medium">{ticket.assignedTo?.name || "Unassigned"}</span>
            </p>
            <select
              defaultValue={ticket.assignedTo?.id || ""}
              disabled={updating}
              onChange={(e) => { if (e.target.value) handleAssign(e.target.value); }}
              className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-primary disabled:opacity-50"
            >
              <option value="" disabled>Reassign to...</option>
              {admins.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">Update Status</h2>
            <div className="space-y-2">
              {ORDERED_STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  disabled={updating || s === ticket.status}
                  className={`w-full rounded-lg px-4 py-2.5 text-left text-sm font-medium transition-colors ${
                    s === ticket.status
                      ? "bg-primary text-white"
                      : "border border-border text-foreground hover:bg-gray-50 disabled:opacity-50"
                  }`}
                >
                  {getStatusLabel(s)}{s === ticket.status && " (Current)"}
                </button>
              ))}
            </div>
          </div>

          {/* Case Chat */}
          {currentUserId && (
            <ChatPanel ticketId={id} currentUserId={currentUserId} />
          )}
        </div>
      </div>
    </div>
  );
}
