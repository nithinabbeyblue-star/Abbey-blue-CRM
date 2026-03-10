"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { StatusBadge, ORDERED_STATUSES, getStatusLabel } from "@/components/ui/status-badge";
import { CaseBadge } from "@/components/ui/case-badge";

interface FollowupCase {
  id: string;
  refNumber: string;
  clientName: string;
  clientPhone: string;
  caseType: string | null;
  status: string;
  totalAmount: number;
  amountPaid: number;
  amountDue: number;
  updatedAt: string;
  createdBy: { id: string; name: string };
  assignedTo: { id: string; name: string } | null;
}

interface Summary {
  totalCases: number;
  totalOutstanding: number;
  totalCollected: number;
  urgentFollowups: number;
}

type SortField = "clientName" | "status" | "totalAmount" | "amountPaid" | "amountDue" | "updatedAt";

function fmt(n: number): string {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(n);
}

export function PaymentFollowupDashboard({ ticketBasePath }: { ticketBasePath: string }) {
  const [cases, setCases] = useState<FollowupCase[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [outstandingOnly, setOutstandingOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortField>("amountDue");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Log Call modal state
  const [logCallId, setLogCallId] = useState<string | null>(null);
  const [logCallNote, setLogCallNote] = useState("");
  const [logCallSaving, setLogCallSaving] = useState(false);
  const [logCallSuccess, setLogCallSuccess] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (search.trim().length >= 2) params.set("search", search.trim());
      if (outstandingOnly) params.set("outstandingOnly", "true");
      params.set("sortBy", sortBy);
      params.set("sortDir", sortDir);

      const res = await fetch(`/api/payment-followup?${params}`);
      if (res.ok) {
        const data = await res.json();
        setCases(data.cases || []);
        setSummary(data.summary || null);
      }
    } catch {
      // silently fail
    }
    setLoading(false);
  }, [statusFilter, search, outstandingOnly, sortBy, sortDir]);

  useEffect(() => {
    const timer = setTimeout(fetchData, search ? 400 : 0);
    return () => clearTimeout(timer);
  }, [fetchData, search]);

  function handleSort(field: SortField) {
    if (sortBy === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir(field === "clientName" ? "asc" : "desc");
    }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortBy !== field) return <span className="ml-1 text-gray-300">&#8597;</span>;
    return <span className="ml-1">{sortDir === "asc" ? "&#9650;" : "&#9660;"}</span>;
  }

  async function handleLogCall() {
    if (!logCallId || !logCallNote.trim()) return;
    setLogCallSaving(true);
    try {
      const res = await fetch("/api/payment-followup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId: logCallId, note: logCallNote.trim() }),
      });
      if (res.ok) {
        setLogCallSuccess(logCallId);
        setLogCallId(null);
        setLogCallNote("");
        setTimeout(() => setLogCallSuccess(null), 3000);
      }
    } catch {
      // silently fail
    }
    setLogCallSaving(false);
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Payment Follow-up</h1>
        <p className="mt-1 text-sm text-muted">
          Track outstanding balances and follow up with clients on pending payments.
        </p>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wider text-muted">Total Cases</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{summary.totalCases}</p>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wider text-red-600">Outstanding</p>
            <p className="mt-1 text-2xl font-bold text-red-700">{fmt(summary.totalOutstanding)}</p>
          </div>
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wider text-green-600">Collected</p>
            <p className="mt-1 text-2xl font-bold text-green-700">{fmt(summary.totalCollected)}</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wider text-amber-600">Urgent Follow-ups</p>
            <p className="mt-1 text-2xl font-bold text-amber-700">{summary.urgentFollowups}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="min-w-[200px] flex-1 sm:max-w-xs">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search client, phone, or ref..."
            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
        >
          <option value="ALL">All Statuses</option>
          {ORDERED_STATUSES.map((s) => (
            <option key={s} value={s}>
              {getStatusLabel(s)}
            </option>
          ))}
        </select>

        {/* Outstanding Toggle */}
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm transition-colors hover:bg-gray-50">
          <input
            type="checkbox"
            checked={outstandingOnly}
            onChange={(e) => setOutstandingOnly(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-primary accent-primary"
          />
          <span className="whitespace-nowrap text-foreground">Outstanding Only</span>
        </label>
      </div>

      {/* Table */}
      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        {loading ? (
          <div className="py-16 text-center text-sm text-muted">Loading...</div>
        ) : cases.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted">No cases found matching your filters.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-gray-50/50">
                <th className="px-4 py-3 text-left font-medium text-muted">Ref</th>
                <th
                  className="cursor-pointer px-4 py-3 text-left font-medium text-muted hover:text-foreground"
                  onClick={() => handleSort("clientName")}
                >
                  Client <SortIcon field="clientName" />
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted">Visa Type</th>
                <th
                  className="cursor-pointer px-4 py-3 text-left font-medium text-muted hover:text-foreground"
                  onClick={() => handleSort("status")}
                >
                  Status <SortIcon field="status" />
                </th>
                <th
                  className="cursor-pointer px-4 py-3 text-right font-medium text-muted hover:text-foreground"
                  onClick={() => handleSort("totalAmount")}
                >
                  Total <SortIcon field="totalAmount" />
                </th>
                <th
                  className="cursor-pointer px-4 py-3 text-right font-medium text-muted hover:text-foreground"
                  onClick={() => handleSort("amountPaid")}
                >
                  Paid <SortIcon field="amountPaid" />
                </th>
                <th
                  className="cursor-pointer px-4 py-3 text-right font-medium text-muted hover:text-foreground"
                  onClick={() => handleSort("amountDue")}
                >
                  Due <SortIcon field="amountDue" />
                </th>
                <th
                  className="cursor-pointer px-4 py-3 text-left font-medium text-muted hover:text-foreground"
                  onClick={() => handleSort("updatedAt")}
                >
                  Updated <SortIcon field="updatedAt" />
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => {
                const isUrgent = c.status === "APPROVED" && c.amountDue > 0;
                return (
                  <tr
                    key={c.id}
                    className={`border-b border-border transition-colors last:border-0 hover:bg-gray-50 ${
                      isUrgent ? "bg-red-50/60" : ""
                    }`}
                  >
                    {/* Ref */}
                    <td className="px-4 py-3">
                      <Link
                        href={`${ticketBasePath}/${c.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {c.refNumber}
                      </Link>
                    </td>

                    {/* Client */}
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{c.clientName}</p>
                      <div className="mt-0.5 flex items-center gap-2">
                        <span className="text-xs text-muted">{c.clientPhone}</span>
                        <a
                          href={`tel:${c.clientPhone}`}
                          className="inline-flex items-center gap-1 rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700 hover:bg-green-200"
                          title="Quick Call"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          Call
                        </a>
                      </div>
                    </td>

                    {/* Visa Type */}
                    <td className="px-4 py-3">
                      <CaseBadge caseType={c.caseType} />
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={c.status} size="xs" />
                        {isUrgent && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-700">
                            Urgent
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Total */}
                    <td className="px-4 py-3 text-right font-medium text-foreground">
                      {fmt(c.totalAmount)}
                    </td>

                    {/* Paid */}
                    <td className="px-4 py-3 text-right text-green-700">
                      {fmt(c.amountPaid)}
                    </td>

                    {/* Due */}
                    <td className={`px-4 py-3 text-right font-semibold ${c.amountDue > 0 ? "text-red-600" : "text-green-600"}`}>
                      {c.amountDue > 0 ? fmt(c.amountDue) : "Paid"}
                    </td>

                    {/* Updated */}
                    <td className="px-4 py-3 text-xs text-muted">
                      {new Date(c.updatedAt).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => { setLogCallId(c.id); setLogCallNote(""); }}
                          className="rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-gray-100"
                          title="Log a follow-up call"
                        >
                          Log Call
                        </button>
                        {logCallSuccess === c.id && (
                          <span className="text-xs text-green-600">Logged!</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Log Call Modal */}
      {logCallId && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setLogCallId(null)} />
          <div className="fixed inset-x-4 top-1/2 z-50 mx-auto max-w-md -translate-y-1/2 rounded-xl border border-border bg-white p-6 shadow-2xl sm:inset-x-auto">
            <h3 className="text-lg font-semibold text-foreground">Log Follow-up Call</h3>
            <p className="mt-1 text-xs text-muted">
              Record the result of your call for case{" "}
              <span className="font-medium text-foreground">
                {cases.find((c) => c.id === logCallId)?.clientName ?? ""}
              </span>
            </p>
            <textarea
              value={logCallNote}
              onChange={(e) => setLogCallNote(e.target.value)}
              placeholder="e.g. Client confirmed payment by Friday. Sent reminder via WhatsApp."
              rows={4}
              className="mt-3 w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary"
              autoFocus
            />
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => setLogCallId(null)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleLogCall}
                disabled={logCallSaving || !logCallNote.trim()}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
              >
                {logCallSaving ? "Saving..." : "Save Note"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
