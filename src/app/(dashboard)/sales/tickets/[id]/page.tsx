"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
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
  financesUpdatedBy: { name: string } | null;
  financesUpdatedAt: string | null;
  createdBy: { id: string; name: string; email: string };
  assignedTo: { id: string; name: string; email: string } | null;
  auditLogs: AuditLog[];
}

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");

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
    return (
      <div className="py-16 text-center text-sm text-muted">
        Loading ticket...
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-danger">{error || "Ticket not found"}</p>
        <Link
          href="/sales/tickets"
          className="mt-2 inline-block text-sm text-primary hover:underline"
        >
          Back to tickets
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      {/* Pinned Case Header */}
      <CaseHeader
        refNumber={ticket.refNumber}
        clientName={ticket.clientName}
        caseType={ticket.caseType}
        status={ticket.status}
        caseOwner={ticket.createdBy}
        caseWorker={ticket.assignedTo}
        caseDeadline={ticket.caseDeadline}
        backHref="/sales/tickets"
      />

      {/* Editable Client & Case Details */}
      <div className="mt-6">
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
      </div>

      {/* Financials */}
      <div className="mt-4">
        <FinancialCard
          ticketId={ticket.id}
          ablFee={ticket.ablFee}
          govFee={ticket.govFee}
          adverts={ticket.adverts}
          paidAmount={ticket.paidAmount}
          caseDeadline={ticket.caseDeadline}
          financesUpdatedBy={ticket.financesUpdatedBy}
          financesUpdatedAt={ticket.financesUpdatedAt}
          canEditFees={ticket.status === "LEAD"}
          canEditPaidAmount={false}
          canEditDeadline={false}
        />
      </div>

      {/* Notes */}
      {ticket.notes && (
        <div className="mt-4 rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted">
            Notes
          </h2>
          <p className="whitespace-pre-wrap text-sm text-foreground">
            {ticket.notes}
          </p>
        </div>
      )}

      {/* Case Chat */}
      {currentUserId && (
        <div className="mt-4">
          <ChatPanel ticketId={id} currentUserId={currentUserId} />
        </div>
      )}

      {/* Audit Log / Case History */}
      <div className="mt-4 rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">
          Case History
        </h2>
        {ticket.auditLogs.length === 0 ? (
          <p className="text-sm text-muted">No activity recorded yet.</p>
        ) : (
          <div className="space-y-3">
            {ticket.auditLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-3 border-b border-border pb-3 last:border-0 last:pb-0"
              >
                <div className="mt-0.5 h-2 w-2 rounded-full bg-primary" />
                <div className="flex-1">
                  <p className="text-sm text-foreground">
                    <span className="font-medium">{log.user.name}</span>{" "}
                    {log.action.replace(/_/g, " ").toLowerCase()}
                    {log.oldValue && log.newValue && (
                      <>
                        {" "}
                        from{" "}
                        <span className="font-medium">
                          {log.oldValue.replace(/_/g, " ")}
                        </span>{" "}
                        to{" "}
                        <span className="font-medium">
                          {log.newValue.replace(/_/g, " ")}
                        </span>
                      </>
                    )}
                    {!log.oldValue && log.newValue && (
                      <>
                        {" "}
                        &mdash;{" "}
                        <span className="font-medium">
                          {log.newValue.replace(/_/g, " ")}
                        </span>
                      </>
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
  );
}
