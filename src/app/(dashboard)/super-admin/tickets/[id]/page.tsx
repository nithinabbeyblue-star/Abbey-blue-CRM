"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
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
  gender: string | null;
  nationality: string | null;
  address: string | null;
  caseType: string | null;
  status: string;
  source: string;
  priority: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  ablFee: number | null;
  govFee: number | null;
  adsFee: number | null;
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

interface AdminUser {
  id: string;
  name: string;
  email: string;
}

export default function SuperAdminTicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });
  const [currentUserId, setCurrentUserId] = useState("");
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);

  const fetchTicket = useCallback(async () => {
    const [ticketRes, adminsRes, meRes] = await Promise.all([
      fetch(`/api/tickets/${id}`),
      fetch("/api/users/admins"),
      fetch("/api/auth/me"),
    ]);
    if (ticketRes.ok) { const data = await ticketRes.json(); setTicket(data.ticket); }
    if (adminsRes.ok) { const data = await adminsRes.json(); setAdmins(data.admins || []); }
    if (meRes.ok) { const meData = await meRes.json(); setCurrentUserId(meData.user?.userId || ""); }
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
    if (res.ok) { setMessage({ text: `Status updated to ${getStatusLabel(newStatus)}`, type: "success" }); await fetchTicket(); }
    else { const data = await res.json(); setMessage({ text: data.error || "Failed", type: "error" }); }
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
    if (res.ok) { setMessage({ text: "Ticket reassigned", type: "success" }); await fetchTicket(); }
    else { const data = await res.json(); setMessage({ text: data.error || "Failed", type: "error" }); }
    setUpdating(false);
  }

  async function handleDelete() {
    setUpdating(true);
    const res = await fetch(`/api/tickets/${id}`, { method: "DELETE" });
    if (res.ok) { router.push("/super-admin/tickets"); }
    else { const data = await res.json(); setMessage({ text: data.error || "Failed to delete", type: "error" }); setUpdating(false); }
  }

  if (loading) return <div className="py-16 text-center text-sm text-muted">Loading...</div>;
  if (!ticket) return (
    <div className="py-16 text-center">
      <p className="text-sm text-danger">Ticket not found</p>
      <Link href="/super-admin/tickets" className="mt-2 inline-block text-sm text-primary hover:underline">Back</Link>
    </div>
  );

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
        backHref="/super-admin/tickets"
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1fr_400px]">
        {/* Left — Scrollable content */}
        <div className="min-w-0 space-y-4 overflow-y-auto px-8 py-6">
          {message.text && (
            <div className={`rounded-lg border px-4 py-3 text-sm ${message.type === "success" ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}`}>
              {message.text}
            </div>
          )}
          <EditableDetailsCard
            ticketId={id}
            clientName={ticket.clientName}
            clientPhone={ticket.clientPhone}
            clientEmail={ticket.clientEmail}
            gender={ticket.gender}
            nationality={ticket.nationality}
            address={ticket.address}
            caseType={ticket.caseType}
            source={ticket.source}
            caseStartDate={ticket.caseStartDate}
            caseEndDate={ticket.caseEndDate}
            adsFinishingDate={ticket.adsFinishingDate}
            caseDeadline={ticket.caseDeadline}
            onSaved={fetchTicket}
          />

          {/* Update Status */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">Update Status</h2>
            <div className="flex flex-wrap gap-2">
              {ORDERED_STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  disabled={updating || s === ticket.status}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    s === ticket.status
                      ? "bg-primary text-white cursor-default"
                      : "border border-border text-foreground hover:bg-gray-50 disabled:opacity-50"
                  }`}
                >
                  {getStatusLabel(s)}{s === ticket.status && " (Current)"}
                </button>
              ))}
            </div>
          </div>

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

          {/* Notes */}
          {ticket.notes && (
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted">Notes</h2>
              <p className="whitespace-pre-wrap text-sm">{ticket.notes}</p>
            </div>
          )}

          <FinancialCard
            ticketId={id}
            ablFee={ticket.ablFee}
            govFee={ticket.govFee}
            adsFee={ticket.adsFee}
            paidAmount={ticket.paidAmount}
            financesUpdatedBy={ticket.financesUpdatedBy}
            financesUpdatedAt={ticket.financesUpdatedAt}
            canEditFees={true}
            canEditPaidAmount={true}
            canManagePayments={true}
          />

          <DocumentSection ticketId={id} caseType={ticket.caseType} />

          {/* Case History */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">Case History</h2>
            {ticket.auditLogs.length === 0 ? (
              <p className="text-sm text-muted">No activity yet.</p>
            ) : (
              <div className="max-h-[400px] space-y-3 overflow-y-auto pr-1">
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

          {/* Danger Zone */}
          <div className="rounded-xl border border-red-200 bg-card p-6 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-red-600">Danger Zone</h2>
            <p className="mb-3 text-xs text-red-500">Permanently delete this ticket and all associated data.</p>
            <label className="mb-3 flex items-start gap-2 text-xs text-foreground">
              <input
                type="checkbox"
                checked={deleteConfirmed}
                onChange={(e) => setDeleteConfirmed(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-red-300 text-red-600 focus:ring-red-500"
              />
              <span>I confirm that I want to permanently delete this ticket and all associated data.</span>
            </label>
            <button
              onClick={handleDelete}
              disabled={updating || !deleteConfirmed}
              className="rounded-lg border border-red-600 bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Delete Ticket
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
