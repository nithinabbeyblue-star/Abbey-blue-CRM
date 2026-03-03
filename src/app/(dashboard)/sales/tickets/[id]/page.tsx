"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChatPanel } from "@/components/chat/chat-panel";
import { StatusBadge } from "@/components/ui/status-badge";
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

const PRIORITY_LABELS: Record<number, string> = {
  0: "Normal",
  1: "High",
  2: "Urgent",
};

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");

  useEffect(() => {
    async function fetchTicket() {
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
    }
    fetchTicket();
  }, [id]);

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
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/sales/tickets"
            className="text-sm text-muted hover:text-primary"
          >
            &larr; Back to tickets
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-foreground">
            {ticket.refNumber}
          </h1>
          <p className="mt-1 text-sm text-muted">
            Created on{" "}
            {new Date(ticket.createdAt).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
        <StatusBadge status={ticket.status} size="sm" />
      </div>

      {/* Client Info Card */}
      <div className="mt-6 rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">
          Client Information
        </h2>
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-xs font-medium text-muted">Full Name</dt>
            <dd className="mt-1 text-sm font-medium text-foreground">
              {ticket.clientName}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted">Phone</dt>
            <dd className="mt-1 text-sm text-foreground">
              {ticket.clientPhone}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted">Email</dt>
            <dd className="mt-1 text-sm text-foreground">
              {ticket.clientEmail || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted">Nationality</dt>
            <dd className="mt-1 text-sm text-foreground">
              {ticket.nationality || "—"}
            </dd>
          </div>
        </dl>
      </div>

      {/* Visa & Lead Info */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">
            Case Details
          </h2>
          <dl className="space-y-3">
            <div>
              <dt className="text-xs font-medium text-muted">Case Type</dt>
              <dd className="mt-1 text-sm text-foreground">
                <CaseBadge caseType={ticket.caseType} />
                {!ticket.caseType && "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted">Destination</dt>
              <dd className="mt-1 text-sm text-foreground">
                {ticket.destination || "—"}
              </dd>
            </div>
          </dl>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">
            Lead Info
          </h2>
          <dl className="space-y-3">
            <div>
              <dt className="text-xs font-medium text-muted">Source</dt>
              <dd className="mt-1 text-sm text-foreground">
                {ticket.source.replace(/_/g, " ")}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted">Priority</dt>
              <dd className="mt-1 text-sm text-foreground">
                {PRIORITY_LABELS[ticket.priority] || "Normal"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted">Assigned To</dt>
              <dd className="mt-1 text-sm text-foreground">
                {ticket.assignedTo?.name || "Unassigned"}
              </dd>
            </div>
          </dl>
        </div>
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
