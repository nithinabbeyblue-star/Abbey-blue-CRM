"use client";

import { useState } from "react";
import { calcVat, calcTotal, calcDue, formatCurrency } from "@/constants/finance";

interface FinancialCardProps {
  ticketId: string;
  ablFee: number | null;
  govFee: number | null;
  adverts: number | null;
  paidAmount: number;
  caseDeadline: string | null;
  financesUpdatedBy: { name: string } | null;
  financesUpdatedAt: string | null;
  canEditFees: boolean;
  canEditPaidAmount: boolean;
  canEditDeadline: boolean;
}

function parseNum(v: string): number | null {
  if (v === "") return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

export function FinancialCard({
  ticketId,
  ablFee,
  govFee,
  adverts,
  paidAmount,
  caseDeadline,
  financesUpdatedBy,
  financesUpdatedAt,
  canEditFees,
  canEditPaidAmount,
  canEditDeadline,
}: FinancialCardProps) {
  const [ablFeeLocal, setAblFee] = useState(ablFee);
  const [govFeeLocal, setGovFee] = useState(govFee);
  const [advertsLocal, setAdverts] = useState(adverts);
  const [paidLocal, setPaid] = useState(paidAmount);
  const [deadlineLocal, setDeadline] = useState(
    caseDeadline ? caseDeadline.slice(0, 10) : ""
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });

  const vat = calcVat(ablFeeLocal);
  const total = calcTotal(ablFeeLocal, govFeeLocal, advertsLocal);
  const due = calcDue(total, paidLocal);

  const hasChanges =
    ablFeeLocal !== ablFee ||
    govFeeLocal !== govFee ||
    advertsLocal !== adverts ||
    paidLocal !== paidAmount ||
    deadlineLocal !== (caseDeadline ? caseDeadline.slice(0, 10) : "");

  const canEdit = canEditFees || canEditPaidAmount || canEditDeadline;

  async function handleSave() {
    setSaving(true);
    setMessage({ text: "", type: "" });

    try {
      const body: Record<string, unknown> = {};
      if (canEditFees) {
        if (ablFeeLocal !== ablFee) body.ablFee = ablFeeLocal;
        if (govFeeLocal !== govFee) body.govFee = govFeeLocal;
        if (advertsLocal !== adverts) body.adverts = advertsLocal;
      }
      if (canEditPaidAmount && paidLocal !== paidAmount) {
        body.paidAmount = paidLocal;
      }
      if (canEditDeadline && deadlineLocal !== (caseDeadline ? caseDeadline.slice(0, 10) : "")) {
        body.caseDeadline = deadlineLocal || null;
      }

      if (Object.keys(body).length === 0) {
        setSaving(false);
        return;
      }

      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update");
      }

      setMessage({ text: "Financials saved", type: "success" });
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : "Save failed",
        type: "error",
      });
    }

    setSaving(false);
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">
        Financials
      </h2>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {/* ABL Fee (VAT-inclusive) */}
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">ABL Fee <span className="font-normal">(incl. VAT)</span></label>
          {canEditFees ? (
            <input
              type="number"
              step="0.01"
              min="0"
              value={ablFeeLocal ?? ""}
              onChange={(e) => setAblFee(parseNum(e.target.value))}
              placeholder="0.00"
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
            />
          ) : (
            <p className="py-2 text-sm font-medium text-foreground">
              {ablFeeLocal != null ? formatCurrency(ablFeeLocal) : "—"}
            </p>
          )}
          {/* Show VAT breakdown below */}
          {ablFeeLocal != null && ablFeeLocal > 0 && (
            <p className="mt-0.5 text-[11px] text-muted">
              Net: {formatCurrency(ablFeeLocal - vat)} + VAT: {formatCurrency(vat)}
            </p>
          )}
        </div>

        {/* Gov Fee */}
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Gov Fee</label>
          {canEditFees ? (
            <input
              type="number"
              step="0.01"
              min="0"
              value={govFeeLocal ?? ""}
              onChange={(e) => setGovFee(parseNum(e.target.value))}
              placeholder="0.00"
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
            />
          ) : (
            <p className="py-2 text-sm font-medium text-foreground">
              {govFeeLocal != null ? formatCurrency(govFeeLocal) : "—"}
            </p>
          )}
        </div>

        {/* Adverts */}
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Adverts</label>
          {canEditFees ? (
            <input
              type="number"
              step="0.01"
              min="0"
              value={advertsLocal ?? ""}
              onChange={(e) => setAdverts(parseNum(e.target.value))}
              placeholder="0.00"
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
            />
          ) : (
            <p className="py-2 text-sm font-medium text-foreground">
              {advertsLocal != null ? formatCurrency(advertsLocal) : "—"}
            </p>
          )}
        </div>

        {/* VAT (23%) — extracted from ABL fee, read-only */}
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">VAT (23%) <span className="font-normal">in ABL</span></label>
          <p className="py-2 text-sm font-medium text-foreground">
            {formatCurrency(vat)}
          </p>
        </div>

        {/* Total — always read-only, auto-calculated */}
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Total</label>
          <p className="py-2 text-sm font-bold text-foreground">
            {formatCurrency(total)}
          </p>
        </div>

        {/* Paid Amount */}
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Paid</label>
          {canEditPaidAmount ? (
            <input
              type="number"
              step="0.01"
              min="0"
              value={paidLocal}
              onChange={(e) => setPaid(parseFloat(e.target.value) || 0)}
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
            />
          ) : (
            <p className="py-2 text-sm font-medium text-foreground">
              {formatCurrency(paidLocal)}
            </p>
          )}
        </div>
      </div>

      {/* Due Amount — prominent */}
      <div className="mt-4 flex items-center justify-between rounded-lg border border-border bg-gray-50 px-4 py-3">
        <span className="text-sm font-medium text-muted">Amount Due</span>
        <span
          className={`text-lg font-bold ${
            due > 0 ? "text-red-600" : due === 0 ? "text-green-600" : "text-foreground"
          }`}
        >
          {formatCurrency(due)}
        </span>
      </div>

      {/* Deadline */}
      {(canEditDeadline || caseDeadline) && (
        <div className="mt-4">
          <label className="mb-1 block text-xs font-medium text-muted">Case Deadline</label>
          {canEditDeadline ? (
            <input
              type="date"
              value={deadlineLocal}
              onChange={(e) => setDeadline(e.target.value)}
              className="rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
            />
          ) : caseDeadline ? (
            <p className="text-sm text-foreground">
              {new Date(caseDeadline).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </p>
          ) : null}
        </div>
      )}

      {/* Last Updated By */}
      {financesUpdatedBy && financesUpdatedAt && (
        <p className="mt-3 text-xs text-muted">
          Last updated by {financesUpdatedBy.name} on{" "}
          {new Date(financesUpdatedAt).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      )}

      {/* Save + Message */}
      {canEdit && (
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Financials"}
          </button>
          {message.text && (
            <span
              className={`text-xs ${
                message.type === "success" ? "text-green-600" : "text-red-600"
              }`}
            >
              {message.text}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
