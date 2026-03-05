"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ChatPanel } from "@/components/chat/chat-panel";
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
  caseStartDate: string | null;
  caseEndDate: string | null;
  adsFinishingDate: string | null;
  financesUpdatedBy: { name: string } | null;
  financesUpdatedAt: string | null;
  createdBy: { id: string; name: string; email: string };
  assignedTo: { id: string; name: string; email: string } | null;
  auditLogs: AuditLog[];
}

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [deleting, setDeleting] = useState(false);

  const fetchTicket = useCallback(async () => {
    const [ticketRes, meRes] = await Promise.all([
      fetch(`/api/tickets/${id}`),
      fetch("/api/auth/me"),
    ]);
    if (!ticketRes.ok) {
      setError("Ticket not found");
      setLoading(false);
      return;
    }
    const data = await ticketRes.json();
    setTicket(data.ticket);
    if (meRes.ok) {
      const meData = await meRes.json();
      setCurrentUserId(meData.user?.userId || "");
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchTicket();
  }, [fetchTicket]);

  if (loading) {
    return <div className="py-16 text-center text-sm text-muted">Loading ticket...</div>;
  }

  if (error || !ticket) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-danger">{error || "Ticket not found"}</p>
        <Link href="/sales/tickets" className="mt-2 inline-block text-sm text-primary hover:underline">
          Back to tickets
        </Link>
      </div>
    );
  }

  return (
    <div className="-m-8 flex h-screen flex-col overflow-hidden">
      <CaseHeader
        refNumber={ticket.refNumber}
        clientName={ticket.clientName}
        caseType={ticket.caseType}
        status={ticket.status}
        caseOwner={ticket.createdBy}
        caseWorker={ticket.assignedTo}
        createdAt={ticket.createdAt}
        caseDeadline={ticket.caseDeadline}
        adsFinishingDate={ticket.adsFinishingDate}
        backHref="/sales/tickets"
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1fr_400px]">
        {/* Left — Scrollable content */}
        <div className="min-w-0 space-y-4 overflow-y-auto px-8 py-6">
          <EditableDetailsCard
            ticketId={id}
            clientName={ticket.clientName}
            clientPhone={ticket.clientPhone}
            clientEmail={ticket.clientEmail}
            nationality={ticket.nationality}
            caseType={ticket.caseType}
            destination={ticket.destination}
            source={ticket.source}
            caseStartDate={ticket.caseStartDate}
            caseEndDate={ticket.caseEndDate}
            adsFinishingDate={ticket.adsFinishingDate}
            caseDeadline={ticket.caseDeadline}
            onSaved={fetchTicket}
          />

          {ticket.notes && (
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted">Notes</h2>
              <p className="whitespace-pre-wrap text-sm text-foreground">{ticket.notes}</p>
            </div>
          )}

          <FinancialCard
            ticketId={ticket.id}
            ablFee={ticket.ablFee}
            govFee={ticket.govFee}
            adverts={ticket.adverts}
            paidAmount={ticket.paidAmount}
            financesUpdatedBy={ticket.financesUpdatedBy}
            financesUpdatedAt={ticket.financesUpdatedAt}
            canEditFees={ticket.status === "LEAD"}
            canEditPaidAmount={true}
            canManagePayments={true}
          />

          {/* Case History */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">Case History</h2>
            {ticket.auditLogs.length === 0 ? (
              <p className="text-sm text-muted">No activity recorded yet.</p>
            ) : (
              <div className="max-h-[400px] space-y-3 overflow-y-auto pr-1">
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
                          day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Danger Zone */}
          <div className="group rounded-xl border border-border bg-card p-6 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted transition-colors group-hover:text-red-600">
              Danger Zone
            </h2>
            <p className="mb-3 text-xs text-muted transition-colors group-hover:text-red-600">
              Permanently delete this ticket and all associated data.
            </p>
            <button
              onClick={async () => {
                if (!confirm("Are you sure you want to permanently delete this ticket? This cannot be undone.")) return;
                setDeleting(true);
                const res = await fetch(`/api/tickets/${id}`, { method: "DELETE" });
                if (res.ok) {
                  router.push("/sales/tickets");
                } else {
                  const data = await res.json();
                  alert(data.error || "Failed to delete");
                  setDeleting(false);
                }
              }}
              disabled={deleting}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted transition-colors hover:border-red-600 hover:bg-red-600 hover:text-white disabled:opacity-50"
            >
              {deleting ? "Deleting..." : "Delete Ticket"}
            </button>
          </div>

          {/* Mobile Chat */}
          {currentUserId && (
            <div className="lg:hidden">
              <ChatPanel ticketId={id} currentUserId={currentUserId} />
            </div>
          )}
        </div>

        {/* Right — Full-height chat */}
        {currentUserId && (
          <div className="hidden border-l border-border lg:flex lg:flex-col">
            <ChatPanel ticketId={id} currentUserId={currentUserId} />
          </div>
        )}
      </div>
    </div>
  );
}
