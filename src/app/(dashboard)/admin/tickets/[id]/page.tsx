"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { DocumentSection } from "@/components/documents/document-section";
import { ChatPanel } from "@/components/chat/chat-panel";
import { ORDERED_STATUSES, getStatusLabel } from "@/components/ui/status-badge";
import { CaseHeader } from "@/components/tickets/case-header";
import { FinancialCard } from "@/components/tickets/financial-card";
import { EditableDetailsCard } from "@/components/tickets/editable-details-card";

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
  ablFee: number | null;
  govFee: number | null;
  adverts: number | null;
  paidAmount: number;
  caseDeadline: string | null;
  financesUpdatedBy: { name: string } | null;
  financesUpdatedAt: string | null;
  createdBy: { id: string; name: string; email: string };
  assignedTo: { id: string; name: string; email: string } | null;
  auditLogs: AuditLog[];
}

export default function AdminTicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState({ text: "", type: "" });
  const [currentUserId, setCurrentUserId] = useState("");

  const fetchTicket = useCallback(async () => {
    const [res, meRes] = await Promise.all([
      fetch(`/api/tickets/${id}`),
      fetch("/api/auth/me"),
    ]);
    if (!res.ok) {
      setLoading(false);
      return;
    }
    const data = await res.json();
    setTicket(data.ticket);
    setNotes(data.ticket.notes || "");
    if (meRes.ok) {
      const meData = await meRes.json();
      setCurrentUserId(meData.user?.userId || "");
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchTicket();
  }, [fetchTicket]);

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
      setMessage({ text: data.error || "Failed to update", type: "error" });
    }
    setUpdating(false);
  }

  async function handleSaveNotes() {
    setUpdating(true);
    setMessage({ text: "", type: "" });

    const res = await fetch(`/api/tickets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });

    if (res.ok) {
      setMessage({ text: "Notes saved", type: "success" });
      await fetchTicket();
    } else {
      setMessage({ text: "Failed to save notes", type: "error" });
    }
    setUpdating(false);
  }

  if (loading) {
    return <div className="py-16 text-center text-sm text-muted">Loading ticket...</div>;
  }

  if (!ticket) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-danger">Ticket not found</p>
        <Link href="/admin/tickets" className="mt-2 inline-block text-sm text-primary hover:underline">
          Back to tickets
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      {/* Pinned Case Header */}
      <CaseHeader
        refNumber={ticket.refNumber}
        clientName={ticket.clientName}
        caseType={ticket.caseType}
        status={ticket.status}
        caseOwner={ticket.createdBy}
        caseWorker={ticket.assignedTo}
        caseDeadline={ticket.caseDeadline}
        backHref="/admin/tickets"
      />

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

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column — Client & Visa Info */}
        <div className="lg:col-span-2 space-y-4">
          {/* Editable Client & Case Details */}
          <EditableDetailsCard
            ticketId={id}
            clientName={ticket.clientName}
            clientPhone={ticket.clientPhone}
            clientEmail={ticket.clientEmail}
            nationality={ticket.nationality}
            caseType={ticket.caseType}
            destination={ticket.destination}
            source={ticket.source}
            onSaved={fetchTicket}
          />

          {/* Financials */}
          <FinancialCard
            ticketId={id}
            ablFee={ticket.ablFee}
            govFee={ticket.govFee}
            adverts={ticket.adverts}
            paidAmount={ticket.paidAmount}
            caseDeadline={ticket.caseDeadline}
            financesUpdatedBy={ticket.financesUpdatedBy}
            financesUpdatedAt={ticket.financesUpdatedAt}
            canEditFees={false}
            canEditPaidAmount={true}
            canEditDeadline={true}
          />

          {/* Notes */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">
              Case Notes
            </h2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="Add notes about client communication, documents needed, etc."
            />
            <button
              onClick={handleSaveNotes}
              disabled={updating || notes === (ticket.notes || "")}
              className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {updating ? "Saving..." : "Save Notes"}
            </button>
          </div>

          {/* Documents */}
          <DocumentSection ticketId={id} caseType={ticket.caseType} />

          {/* Audit Log */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">
              Case History
            </h2>
            {ticket.auditLogs.length === 0 ? (
              <p className="text-sm text-muted">No activity recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {ticket.auditLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
                    <div className="mt-0.5 h-2 w-2 rounded-full bg-primary" />
                    <div className="flex-1">
                      <p className="text-sm text-foreground">
                        <span className="font-medium">{log.user.name}</span>{" "}
                        {log.action.replace(/_/g, " ").toLowerCase()}
                        {log.oldValue && log.newValue && (
                          <>
                            {" "}from <span className="font-medium">{log.oldValue.replace(/_/g, " ")}</span>{" "}
                            to <span className="font-medium">{log.newValue.replace(/_/g, " ")}</span>
                          </>
                        )}
                        {!log.oldValue && log.newValue && (
                          <> &mdash; <span className="font-medium">{log.newValue.replace(/_/g, " ")}</span></>
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        {new Date(log.createdAt).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column — Status Controls */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">
              Update Status
            </h2>
            <div className="space-y-2">
              {ORDERED_STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  disabled={updating || s === ticket.status}
                  className={`w-full rounded-lg px-4 py-2.5 text-left text-sm font-medium transition-colors ${
                    s === ticket.status
                      ? "bg-primary text-white cursor-default"
                      : "border border-border text-foreground hover:bg-gray-50 disabled:opacity-50"
                  }`}
                >
                  {getStatusLabel(s)}
                  {s === ticket.status && " (Current)"}
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
