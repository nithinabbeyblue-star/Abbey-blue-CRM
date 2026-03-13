"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Search, CheckCircle2, XCircle, ArrowUpDown } from "lucide-react";
import { CaseBadge } from "@/components/ui/case-badge";

interface BoardCase {
  id: string;
  refNumber: string;
  clientName: string;
  clientPhone: string;
  caseType: string | null;
  priority: number;
  ablFee: number | null;
  govFee: number | null;
  paidAmount: number;
  createdAt: string;
  updatedAt: string;
  createdBy: { name: string };
  assignedTo: { name: string } | null;
}

type SortField = "clientName" | "updatedAt" | "createdAt";
type SortDir = "asc" | "desc";

const PRIORITY_LABELS: Record<number, { label: string; color: string }> = {
  0: { label: "Normal", color: "text-muted" },
  1: { label: "High", color: "text-orange-600" },
  2: { label: "Urgent", color: "text-red-600 font-bold" },
};

interface CaseStatusBoardProps {
  basePath: string; // e.g. "/super-admin", "/admin", "/sales"
}

export function CaseStatusBoard({ basePath }: CaseStatusBoardProps) {
  const [approved, setApproved] = useState<BoardCase[]>([]);
  const [rejected, setRejected] = useState<BoardCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"approved" | "rejected">("approved");
  const [sortField, setSortField] = useState<SortField>("updatedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  useEffect(() => {
    fetch("/api/tickets/board")
      .then((r) => r.json())
      .then((data) => {
        setApproved(data.approved || []);
        setRejected(data.rejected || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  const filteredApproved = useMemo(() => {
    let list = approved;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.clientName.toLowerCase().includes(q) ||
          c.refNumber.toLowerCase().includes(q) ||
          c.clientPhone.includes(q)
      );
    }
    list = [...list].sort((a, b) => {
      const aVal = sortField === "clientName" ? a.clientName : a[sortField];
      const bVal = sortField === "clientName" ? b.clientName : b[sortField];
      const cmp = String(aVal).localeCompare(String(bVal));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [approved, search, sortField, sortDir]);

  const filteredRejected = useMemo(() => {
    let list = rejected;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.clientName.toLowerCase().includes(q) ||
          c.refNumber.toLowerCase().includes(q) ||
          c.clientPhone.includes(q)
      );
    }
    list = [...list].sort((a, b) => {
      const aVal = sortField === "clientName" ? a.clientName : a[sortField];
      const bVal = sortField === "clientName" ? b.clientName : b[sortField];
      const cmp = String(aVal).localeCompare(String(bVal));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [rejected, search, sortField, sortDir]);

  const activeCases = activeTab === "approved" ? filteredApproved : filteredRejected;

  if (loading) {
    return (
      <div className="py-16 text-center text-sm text-muted">Loading case board...</div>
    );
  }

  return (
    <div>
      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <button
          onClick={() => setActiveTab("approved")}
          className={`group relative overflow-hidden rounded-xl border p-6 text-left transition-all ${
            activeTab === "approved"
              ? "border-emerald-300 bg-emerald-50 shadow-md shadow-emerald-100"
              : "border-border bg-card hover:border-emerald-200 hover:shadow-sm"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                activeTab === "approved" ? "bg-emerald-500" : "bg-emerald-100"
              }`}>
                <CheckCircle2 className={`h-6 w-6 ${
                  activeTab === "approved" ? "text-white" : "text-emerald-600"
                }`} />
              </div>
              <div>
                <p className="text-sm font-medium text-muted">Approved Cases</p>
                <p className="text-3xl font-bold text-emerald-700">{approved.length}</p>
              </div>
            </div>
            {activeTab === "approved" && (
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500 transition-opacity"
               style={{ opacity: activeTab === "approved" ? 1 : 0 }} />
        </button>

        <button
          onClick={() => setActiveTab("rejected")}
          className={`group relative overflow-hidden rounded-xl border p-6 text-left transition-all ${
            activeTab === "rejected"
              ? "border-red-300 bg-red-50 shadow-md shadow-red-100"
              : "border-border bg-card hover:border-red-200 hover:shadow-sm"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                activeTab === "rejected" ? "bg-red-600" : "bg-red-100"
              }`}>
                <XCircle className={`h-6 w-6 ${
                  activeTab === "rejected" ? "text-white" : "text-red-600"
                }`} />
              </div>
              <div>
                <p className="text-sm font-medium text-muted">Rejected Cases</p>
                <p className="text-3xl font-bold text-red-700">{rejected.length}</p>
              </div>
            </div>
            {activeTab === "rejected" && (
              <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            )}
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-red-600 transition-opacity"
               style={{ opacity: activeTab === "rejected" ? 1 : 0 }} />
        </button>
      </div>

      {/* Search & Sort Bar */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by client, ref, or phone..."
            className="w-full rounded-lg border border-border bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">Sort:</span>
          {(["updatedAt", "createdAt", "clientName"] as SortField[]).map((f) => (
            <button
              key={f}
              onClick={() => toggleSort(f)}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                sortField === f
                  ? "bg-primary/10 text-primary"
                  : "text-muted hover:bg-gray-100"
              }`}
            >
              {f === "updatedAt" ? "Updated" : f === "createdAt" ? "Created" : "Name"}
              {sortField === f && (
                <ArrowUpDown className="h-3 w-3" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Cases Table */}
      <div className={`mt-4 overflow-hidden rounded-xl border shadow-sm ${
        activeTab === "approved"
          ? "border-emerald-200 bg-white"
          : "border-red-200 bg-white"
      }`}>
        <div className={`flex items-center justify-between px-6 py-3 ${
          activeTab === "approved"
            ? "bg-emerald-50 border-b border-emerald-200"
            : "bg-red-50 border-b border-red-200"
        }`}>
          <h2 className={`text-sm font-semibold ${
            activeTab === "approved" ? "text-emerald-800" : "text-red-800"
          }`}>
            {activeTab === "approved" ? "Approved" : "Rejected"} Cases
          </h2>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
            activeTab === "approved"
              ? "bg-emerald-100 text-emerald-700"
              : "bg-red-100 text-red-700"
          }`}>
            {activeCases.length} {activeCases.length === 1 ? "case" : "cases"}
          </span>
        </div>

        {activeCases.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-muted">
              {search.trim()
                ? "No cases match your search."
                : `No ${activeTab} cases found.`}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-gray-50/50">
                  <th className="px-4 py-3 text-left font-medium text-muted">Ref</th>
                  <th className="px-4 py-3 text-left font-medium text-muted">Client</th>
                  <th className="px-4 py-3 text-left font-medium text-muted">Case Type</th>
                  <th className="px-4 py-3 text-left font-medium text-muted">Priority</th>
                  <th className="px-4 py-3 text-left font-medium text-muted">Owner</th>
                  <th className="px-4 py-3 text-left font-medium text-muted">Worker</th>
                  <th className="px-4 py-3 text-right font-medium text-muted">Total Fee</th>
                  <th className="px-4 py-3 text-right font-medium text-muted">Paid</th>
                  <th className="px-4 py-3 text-left font-medium text-muted">Updated</th>
                </tr>
              </thead>
              <tbody>
                {activeCases.map((c) => {
                  const pri = PRIORITY_LABELS[c.priority] || PRIORITY_LABELS[0];
                  const totalFee = (c.ablFee || 0) + (c.govFee || 0);
                  const isPaid = totalFee > 0 && c.paidAmount >= totalFee;
                  return (
                    <tr key={c.id} className="border-b border-border last:border-0 hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <Link
                          href={`${basePath}/tickets/${c.id}`}
                          className={`font-medium hover:underline ${
                            activeTab === "approved" ? "text-emerald-700" : "text-red-700"
                          }`}
                        >
                          {c.refNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{c.clientName}</div>
                        <div className="text-xs text-muted">{c.clientPhone}</div>
                      </td>
                      <td className="px-4 py-3">
                        <CaseBadge caseType={c.caseType} />
                        {!c.caseType && <span className="text-muted">-</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium ${pri.color}`}>{pri.label}</span>
                      </td>
                      <td className="px-4 py-3 text-muted">{c.createdBy?.name}</td>
                      <td className="px-4 py-3 text-muted">{c.assignedTo?.name || "-"}</td>
                      <td className="px-4 py-3 text-right font-medium text-foreground">
                        {totalFee > 0 ? `\u00A3${totalFee.toLocaleString("en-GB", { minimumFractionDigits: 2 })}` : "-"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-medium ${isPaid ? "text-emerald-600" : c.paidAmount > 0 ? "text-orange-600" : "text-muted"}`}>
                          {c.paidAmount > 0
                            ? `\u00A3${c.paidAmount.toLocaleString("en-GB", { minimumFractionDigits: 2 })}`
                            : "-"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted">
                        {new Date(c.updatedAt).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
