"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Search,
  Clock,
  AlertTriangle,
  Send,
  X,
  ChevronDown,
  ChevronUp,
  Calendar,
  Shield,
  Mail,
  CheckCircle2,
  Timer,
  Loader2,
} from "lucide-react";
import { CaseBadge } from "@/components/ui/case-badge";
import { URGENCY_STYLES, MILESTONES, type DeadlineInfo } from "@/lib/deadlines";

interface DeadlineCase {
  id: string;
  refNumber: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string | null;
  caseType: string | null;
  status: string;
  priority: number;
  caseDeadline: string | null;
  caseEndDate: string | null;
  adsFinishingDate: string | null;
  createdAt: string;
  createdBy: { name: string };
  assignedTo: { name: string } | null;
  deadlineInfo: DeadlineInfo;
}

interface DeadlineEngineProps {
  basePath: string;
  userRole: string;
}

type FilterUrgency = "all" | DeadlineInfo["urgency"];

export function DeadlineEngine({ basePath, userRole }: DeadlineEngineProps) {
  const [cases, setCases] = useState<DeadlineCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterUrgency, setFilterUrgency] = useState<FilterUrgency>("all");
  const [emailModal, setEmailModal] = useState<DeadlineCase | null>(null);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/tickets/deadlines")
      .then((r) => r.json())
      .then((data) => setCases(data.cases || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Summary counts
  const summary = useMemo(() => {
    const counts = { expired: 0, critical: 0, urgent: 0, warning: 0, safe: 0, total: 0 };
    for (const c of cases) {
      counts[c.deadlineInfo.urgency]++;
      counts.total++;
    }
    return counts;
  }, [cases]);

  // Filtered list
  const filtered = useMemo(() => {
    let list = cases;
    if (filterUrgency !== "all") {
      list = list.filter((c) => c.deadlineInfo.urgency === filterUrgency);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.clientName.toLowerCase().includes(q) ||
          c.refNumber.toLowerCase().includes(q) ||
          c.clientPhone.includes(q)
      );
    }
    return list;
  }, [cases, filterUrgency, search]);

  async function handleSendReminder(caseItem: DeadlineCase) {
    setSending(true);
    setSendResult(null);
    try {
      const res = await fetch("/api/tickets/deadlines/send-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId: caseItem.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setSendResult({ success: true, message: data.message });
      } else {
        setSendResult({ success: false, message: data.error || "Failed to send" });
      }
    } catch {
      setSendResult({ success: false, message: "Network error" });
    }
    setSending(false);
  }

  const canSendEmail = ["SUPER_ADMIN", "SALES_MANAGER", "ADMIN_MANAGER", "SALES"].includes(userRole);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted">Loading deadline engine...</span>
      </div>
    );
  }

  return (
    <div>
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {(["expired", "critical", "urgent", "warning", "safe"] as const).map((level) => {
          const styles = URGENCY_STYLES[level];
          const count = summary[level];
          const labels = {
            expired: "Expired",
            critical: "Critical (<14d)",
            urgent: "Urgent (<30d)",
            warning: "Warning (<90d)",
            safe: "Safe (90d+)",
          };
          return (
            <button
              key={level}
              onClick={() => setFilterUrgency(filterUrgency === level ? "all" : level)}
              className={`relative overflow-hidden rounded-xl border p-4 text-left transition-all ${
                filterUrgency === level
                  ? `${styles.border} ${styles.bg} shadow-md ring-2 ring-offset-1 ${level === "expired" || level === "critical" ? "ring-red-300" : level === "urgent" ? "ring-orange-300" : level === "warning" ? "ring-amber-300" : "ring-emerald-300"}`
                  : "border-border bg-card hover:shadow-sm"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted">{labels[level]}</p>
                  <p className={`text-2xl font-bold ${styles.text}`}>{count}</p>
                </div>
                <div className={`h-3 w-3 rounded-full ${styles.dot}`} />
              </div>
              {filterUrgency === level && (
                <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${level === "safe" ? "bg-emerald-500" : level === "warning" ? "bg-amber-500" : level === "urgent" ? "bg-orange-500" : "bg-red-500"}`} />
              )}
            </button>
          );
        })}
      </div>

      {/* Search Bar */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search cases..."
            className="w-full rounded-lg border border-border bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-muted">
          <Timer className="h-4 w-4" />
          <span>{filtered.length} cases with deadlines</span>
          {filterUrgency !== "all" && (
            <button
              onClick={() => setFilterUrgency("all")}
              className="ml-1 rounded bg-gray-100 px-2 py-0.5 text-xs text-muted hover:bg-gray-200"
            >
              Clear filter
            </button>
          )}
        </div>
      </div>

      {/* Case List */}
      <div className="mt-4 space-y-2">
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-border bg-card py-12 text-center">
            <Calendar className="mx-auto h-10 w-10 text-muted/40" />
            <p className="mt-3 text-sm text-muted">
              {cases.length === 0
                ? "No cases with deadlines set. Add deadlines to your cases to track them here."
                : "No cases match the current filter."}
            </p>
          </div>
        ) : (
          filtered.map((c) => {
            const styles = URGENCY_STYLES[c.deadlineInfo.urgency];
            const isExpanded = expandedId === c.id;
            const deadlineDate = c.caseDeadline || c.caseEndDate || c.adsFinishingDate;

            return (
              <div
                key={c.id}
                className={`rounded-xl border transition-all ${styles.border} ${isExpanded ? styles.bg : "bg-white hover:shadow-sm"}`}
              >
                {/* Main Row */}
                <div
                  className="flex cursor-pointer items-center gap-4 px-4 py-3"
                  onClick={() => setExpandedId(isExpanded ? null : c.id)}
                >
                  {/* Urgency Indicator */}
                  <div className="flex shrink-0 flex-col items-center">
                    <div className={`h-3 w-3 rounded-full ${styles.dot}`} />
                    <div className={`mt-1 text-center text-[10px] font-bold uppercase tracking-wider ${styles.text}`}>
                      {c.deadlineInfo.daysRemaining <= 0
                        ? "EXP"
                        : `${c.deadlineInfo.daysRemaining}d`}
                    </div>
                  </div>

                  {/* Case Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`${basePath}/tickets/${c.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-medium text-primary hover:underline"
                      >
                        {c.refNumber}
                      </Link>
                      <CaseBadge caseType={c.caseType} />
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-muted">
                      <span className="font-medium text-foreground">{c.clientName}</span>
                      <span>{c.clientPhone}</span>
                    </div>
                  </div>

                  {/* Deadline Badge */}
                  <div className="hidden shrink-0 sm:block">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${styles.badge}`}>
                      {c.deadlineInfo.urgency === "expired" ? (
                        <AlertTriangle className="h-3 w-3" />
                      ) : (
                        <Clock className="h-3 w-3" />
                      )}
                      {c.deadlineInfo.label}
                    </span>
                  </div>

                  {/* Assigned To */}
                  <div className="hidden shrink-0 text-right text-xs text-muted lg:block">
                    <span>{c.assignedTo?.name || "Unassigned"}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 items-center gap-1">
                    {canSendEmail && c.clientEmail && c.deadlineInfo.milestone && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEmailModal(c);
                          setSendResult(null);
                        }}
                        className="rounded-lg p-2 text-primary hover:bg-primary/10 transition-colors"
                        title="Send reminder email"
                      >
                        <Mail className="h-4 w-4" />
                      </button>
                    )}
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted" />
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className={`border-t px-4 py-3 ${styles.border}`}>
                    <div className="grid grid-cols-2 gap-4 text-xs sm:grid-cols-4">
                      <div>
                        <span className="text-muted">Deadline</span>
                        <p className={`font-semibold ${styles.text}`}>
                          {deadlineDate
                            ? new Date(deadlineDate).toLocaleDateString("en-IE", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })
                            : "—"}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted">Status</span>
                        <p className="font-medium text-foreground">{c.status.replace(/_/g, " ")}</p>
                      </div>
                      <div>
                        <span className="text-muted">Owner</span>
                        <p className="font-medium text-foreground">{c.createdBy.name}</p>
                      </div>
                      <div>
                        <span className="text-muted">Worker</span>
                        <p className="font-medium text-foreground">{c.assignedTo?.name || "Unassigned"}</p>
                      </div>
                      {c.adsFinishingDate && c.adsFinishingDate !== c.caseDeadline && (
                        <div>
                          <span className="text-muted">ADS Finishing</span>
                          <p className="font-medium text-foreground">
                            {new Date(c.adsFinishingDate).toLocaleDateString("en-IE", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </p>
                        </div>
                      )}
                      {c.clientEmail && (
                        <div>
                          <span className="text-muted">Client Email</span>
                          <p className="font-medium text-foreground">{c.clientEmail}</p>
                        </div>
                      )}
                    </div>

                    {/* Milestone Progress */}
                    <div className="mt-3">
                      <div className="flex items-center gap-1">
                        {[...MILESTONES].reverse().map((m) => {
                          const isHit = c.deadlineInfo.daysRemaining <= m;
                          return (
                            <div key={m} className="flex flex-1 flex-col items-center">
                              <div
                                className={`h-1.5 w-full rounded-full ${
                                  isHit
                                    ? m <= 14
                                      ? "bg-red-400"
                                      : m <= 30
                                        ? "bg-orange-400"
                                        : m <= 60
                                          ? "bg-amber-400"
                                          : "bg-emerald-400"
                                    : "bg-gray-200"
                                }`}
                              />
                              <span className={`mt-1 text-[9px] ${isHit ? "font-semibold text-foreground" : "text-muted"}`}>
                                {m}d
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="mt-3 flex gap-2">
                      <Link
                        href={`${basePath}/tickets/${c.id}`}
                        className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-hover transition-colors"
                      >
                        View Case
                      </Link>
                      {canSendEmail && c.clientEmail && (
                        <button
                          onClick={() => {
                            setEmailModal(c);
                            setSendResult(null);
                          }}
                          className="flex items-center gap-1.5 rounded-lg border border-primary/30 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/5 transition-colors"
                        >
                          <Send className="h-3 w-3" />
                          Send Reminder
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Email Preview Modal */}
      {emailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold text-foreground">Send Deadline Reminder</h3>
              </div>
              <button
                onClick={() => setEmailModal(null)}
                className="rounded-lg p-1.5 text-muted hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-4">
              <div className="rounded-lg border border-border bg-gray-50 p-4">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-14 shrink-0 text-xs font-medium text-muted">To:</span>
                    <span className="font-medium text-foreground">{emailModal.clientEmail}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-14 shrink-0 text-xs font-medium text-muted">Ref:</span>
                    <span className="text-foreground">{emailModal.refNumber}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-14 shrink-0 text-xs font-medium text-muted">Client:</span>
                    <span className="text-foreground">{emailModal.clientName}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <div className="text-sm text-amber-800">
                    <p className="font-medium">
                      {emailModal.deadlineInfo.label} — Milestone: {emailModal.deadlineInfo.milestone || emailModal.deadlineInfo.daysRemaining} days
                    </p>
                    <p className="mt-1 text-xs text-amber-600">
                      A professional reminder email will be sent to the client about their upcoming deadline.
                    </p>
                  </div>
                </div>
              </div>

              {/* Email preview snippet */}
              <div className="mt-4 max-h-40 overflow-y-auto rounded-lg border border-border bg-white p-4 text-xs text-muted">
                <p className="font-medium text-foreground">Email Preview:</p>
                <p className="mt-2">Dear {emailModal.clientName},</p>
                <p className="mt-1">
                  This is a courtesy reminder that your{" "}
                  <strong>{(emailModal.caseType || "Immigration Case").replace(/_/g, " ")}</strong> is due to expire on{" "}
                  <strong>
                    {new Date(
                      emailModal.caseDeadline || emailModal.caseEndDate || emailModal.adsFinishingDate || ""
                    ).toLocaleDateString("en-IE", { day: "numeric", month: "long", year: "numeric" })}
                  </strong>{" "}
                  — that&apos;s <strong>{emailModal.deadlineInfo.daysRemaining} days</strong> from today.
                </p>
                <p className="mt-1 italic text-muted">...includes next steps and contact details...</p>
              </div>

              {sendResult && (
                <div className={`mt-3 flex items-center gap-2 rounded-lg p-3 text-sm ${
                  sendResult.success
                    ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
                    : "bg-red-50 border border-red-200 text-red-700"
                }`}>
                  {sendResult.success ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <AlertTriangle className="h-4 w-4" />
                  )}
                  {sendResult.message}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
              <button
                onClick={() => setEmailModal(null)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSendReminder(emailModal)}
                disabled={sending || (sendResult?.success ?? false)}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors ${
                  sendResult?.success
                    ? "bg-emerald-500"
                    : "bg-primary hover:bg-primary-hover"
                } disabled:opacity-50`}
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : sendResult?.success ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {sending ? "Sending..." : sendResult?.success ? "Sent!" : "Send Reminder"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
