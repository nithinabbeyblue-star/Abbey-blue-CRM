"use client";

import { useEffect, useState, useCallback } from "react";
import { calcVat, calcTotal, calcDue, formatCurrency } from "@/constants/finance";

interface Payment {
  id: string;
  amount: number;
  currency: string;
  type: string;
  status: string;
  notes: string | null;
  paidAt: string | null;
  createdAt: string;
  recordedBy: { name: string };
}

interface FinancialCardProps {
  ticketId: string;
  ablFee: number | null;
  govFee: number | null;
  adsFee: number | null;
  paidAmount: number;
  financesUpdatedBy: { name: string } | null;
  financesUpdatedAt: string | null;
  canEditFees: boolean;
  canEditPaidAmount: boolean;
  canManagePayments?: boolean;
}

function parseNum(v: string): number | null {
  if (v === "") return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

const PAYMENT_TYPES = [
  { value: "INITIAL_PAYMENT", label: "Initial Payment" },
  { value: "FINAL_PAYMENT", label: "Final Payment" },
  { value: "OTHER", label: "Other" },
];

export function FinancialCard({
  ticketId,
  ablFee,
  govFee,
  adsFee,
  paidAmount,
  financesUpdatedBy,
  financesUpdatedAt,
  canEditFees,
  canEditPaidAmount,
  canManagePayments = false,
}: FinancialCardProps) {
  const [ablFeeLocal, setAblFee] = useState(ablFee);
  const [govFeeLocal, setGovFee] = useState(govFee);
  const [adsFeeLocal, setAdsFee] = useState(adsFee);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });

  // Payment records
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(true);

  // Inline add-payment form
  const [addAmount, setAddAmount] = useState("");
  const [addType, setAddType] = useState("");
  const [addNotes, setAddNotes] = useState("");
  const [addSaving, setAddSaving] = useState(false);

  // Edit payment
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editType, setEditType] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const vat = calcVat(ablFeeLocal);
  const total = calcTotal(ablFeeLocal, govFeeLocal, null, adsFeeLocal);

  // Amount Paid = sum of all PAID payment records
  const amountPaid = payments
    .filter((p) => p.status === "PAID")
    .reduce((sum, p) => sum + p.amount, 0);
  const due = calcDue(total, amountPaid);

  const feeChanges =
    ablFeeLocal !== ablFee ||
    govFeeLocal !== govFee ||
    adsFeeLocal !== adsFee;

  const fetchPayments = useCallback(async () => {
    setLoadingPayments(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/payments`);
      if (res.ok) {
        const data = await res.json();
        setPayments(data.payments);
      }
    } catch {
      // silently fail
    }
    setLoadingPayments(false);
  }, [ticketId]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  // Sync paidAmount to ticket whenever payments change
  useEffect(() => {
    if (loadingPayments) return;
    if (amountPaid !== paidAmount) {
      fetch(`/api/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paidAmount: amountPaid }),
      }).catch(() => {});
    }
  }, [amountPaid, paidAmount, ticketId, loadingPayments]);

  async function handleSaveFees() {
    setSaving(true);
    setMessage({ text: "", type: "" });

    try {
      const body: Record<string, unknown> = {};
      if (ablFeeLocal !== ablFee) body.ablFee = ablFeeLocal;
      if (govFeeLocal !== govFee) body.govFee = govFeeLocal;
      if (adsFeeLocal !== adsFee) body.adsFee = adsFeeLocal;

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

      setMessage({ text: "Fees saved", type: "success" });
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : "Save failed",
        type: "error",
      });
    }

    setSaving(false);
  }

  async function handleAddPayment() {
    if (!addAmount || !addType) return;
    setAddSaving(true);

    try {
      const res = await fetch(`/api/tickets/${ticketId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(addAmount),
          type: addType,
          status: "PAID",
          notes: addNotes || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to record payment");
      }

      setAddAmount("");
      setAddType("");
      setAddNotes("");
      await fetchPayments();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Payment failed");
    }

    setAddSaving(false);
  }

  function startEdit(p: Payment) {
    setEditingPayment(p);
    setEditAmount(String(p.amount));
    setEditType(p.type);
    setEditNotes(p.notes || "");
  }

  function cancelEdit() {
    setEditingPayment(null);
  }

  async function handleEditSave() {
    if (!editingPayment) return;
    setEditSaving(true);

    try {
      const res = await fetch(`/api/tickets/${ticketId}/payments`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: editingPayment.id,
          amount: parseFloat(editAmount),
          type: editType,
          notes: editNotes,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update payment");
      }

      setEditingPayment(null);
      await fetchPayments();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Update failed");
    }

    setEditSaving(false);
  }

  async function handleDeletePayment(paymentId: string) {
    if (!confirm("Delete this payment record?")) return;

    try {
      const res = await fetch(`/api/tickets/${ticketId}/payments`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete");
      }
      await fetchPayments();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    }
  }

  const statusColor = (status: string) => {
    const colors: Record<string, string> = {
      PAID: "bg-green-100 text-green-700",
      PENDING: "bg-yellow-100 text-yellow-700",
      REFUNDED: "bg-red-100 text-red-700",
    };
    return colors[status] || "bg-gray-100 text-gray-700";
  };

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      {/* Header */}
      <div className="border-b border-border px-6 py-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
          Financial Information
        </h2>
      </div>

      <div className="p-6">
        {/* Fee Inputs */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">
              ABL Fee <span className="font-normal">(incl. 23% VAT)</span>
            </label>
            {canEditFees ? (
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">&#8364;</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={ablFeeLocal ?? ""}
                  onChange={(e) => setAblFee(parseNum(e.target.value))}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-border bg-white py-2.5 pl-7 pr-3 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary/20"
                />
              </div>
            ) : (
              <p className="py-2.5 text-sm font-medium text-foreground">
                {ablFeeLocal != null ? formatCurrency(ablFeeLocal) : "—"}
              </p>
            )}
            {ablFeeLocal != null && ablFeeLocal > 0 && (
              <p className="mt-1 text-[11px] text-muted">
                Net: {formatCurrency(ablFeeLocal - vat)} &middot; VAT: {formatCurrency(vat)}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">Gov Fee</label>
            {canEditFees ? (
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">&#8364;</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={govFeeLocal ?? ""}
                  onChange={(e) => setGovFee(parseNum(e.target.value))}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-border bg-white py-2.5 pl-7 pr-3 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary/20"
                />
              </div>
            ) : (
              <p className="py-2.5 text-sm font-medium text-foreground">
                {govFeeLocal != null ? formatCurrency(govFeeLocal) : "—"}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">ADS Fee</label>
            {canEditFees ? (
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">&#8364;</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={adsFeeLocal ?? ""}
                  onChange={(e) => setAdsFee(parseNum(e.target.value))}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-border bg-white py-2.5 pl-7 pr-3 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary/20"
                />
              </div>
            ) : (
              <p className="py-2.5 text-sm font-medium text-foreground">
                {adsFeeLocal != null ? formatCurrency(adsFeeLocal) : "—"}
              </p>
            )}
          </div>
        </div>

        {/* Save Fees */}
        {canEditFees && (
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={handleSaveFees}
              disabled={!feeChanges || saving}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Fees"}
            </button>
            {message.text && (
              <span className={`text-xs ${message.type === "success" ? "text-green-600" : "text-red-600"}`}>
                {message.text}
              </span>
            )}
          </div>
        )}

        {/* Summary Cards */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-border bg-gray-50 p-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted">VAT (23%)</p>
            <p className="mt-1 text-base font-semibold text-foreground">{formatCurrency(vat)}</p>
          </div>
          <div className="rounded-lg border border-border bg-gray-50 p-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted">Total</p>
            <p className="mt-1 text-base font-bold text-foreground">{formatCurrency(total)}</p>
          </div>
          <div className="rounded-lg border border-border bg-gray-50 p-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted">Paid</p>
            <p className="mt-1 text-base font-semibold text-green-600">{formatCurrency(amountPaid)}</p>
          </div>
          <div className={`rounded-lg border p-3 ${due > 0 ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"}`}>
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted">Due</p>
            <p className={`mt-1 text-base font-bold ${due > 0 ? "text-red-600" : "text-green-600"}`}>
              {formatCurrency(due)}
            </p>
          </div>
        </div>

        {/* Last Updated */}
        {financesUpdatedBy && financesUpdatedAt && (
          <p className="mt-3 text-[11px] text-muted">
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
      </div>

      {/* Payment Section */}
      <div className="border-t border-border px-6 py-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">
          Payment Records
        </h3>

        {/* Add Payment Form — always visible when user can manage */}
        {canManagePayments && (
          <div className="mt-3 rounded-lg border border-dashed border-border bg-gray-50/50 p-4">
            <p className="mb-3 text-xs font-semibold text-foreground">Add Payment</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-muted">Payment Type</label>
                <select
                  value={addType}
                  onChange={(e) => setAddType(e.target.value)}
                  className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary/20"
                >
                  <option value="" disabled>Select type</option>
                  {PAYMENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-muted">Amount</label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">&#8364;</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={addAmount}
                    onChange={(e) => setAddAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-border bg-white py-2 pl-7 pr-3 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary/20"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-muted">Notes</label>
                <input
                  type="text"
                  value={addNotes}
                  onChange={(e) => setAddNotes(e.target.value)}
                  placeholder="Optional"
                  className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary/20"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleAddPayment}
                  disabled={addSaving || !addAmount || !addType}
                  className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
                >
                  {addSaving ? "Saving..." : "Add Payment"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Payment History */}
        <div className="mt-4">
          {loadingPayments ? (
            <p className="py-4 text-center text-xs text-muted">Loading payments...</p>
          ) : payments.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted">No payment records yet.</p>
          ) : (
            <div className="max-h-[280px] space-y-2 overflow-y-auto pr-1">
              {payments.map((p) => (
                <div key={p.id}>
                  {editingPayment?.id === p.id ? (
                    /* Inline edit row */
                    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
                        <div>
                          <label className="mb-1 block text-[11px] text-muted">Type</label>
                          <select
                            value={editType}
                            onChange={(e) => setEditType(e.target.value)}
                            className="w-full rounded-lg border border-border bg-white px-3 py-1.5 text-sm outline-none focus:border-primary"
                          >
                            {PAYMENT_TYPES.map((t) => (
                              <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] text-muted">Amount</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={editAmount}
                            onChange={(e) => setEditAmount(e.target.value)}
                            className="w-full rounded-lg border border-border bg-white px-3 py-1.5 text-sm outline-none focus:border-primary"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] text-muted">Notes</label>
                          <input
                            type="text"
                            value={editNotes}
                            onChange={(e) => setEditNotes(e.target.value)}
                            placeholder="Optional"
                            className="w-full rounded-lg border border-border bg-white px-3 py-1.5 text-sm outline-none focus:border-primary"
                          />
                        </div>
                        <div className="flex items-end gap-2">
                          <button
                            onClick={handleEditSave}
                            disabled={editSaving || !editAmount || !editType}
                            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
                          >
                            {editSaving ? "..." : "Save"}
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Display row */
                    <div className="flex items-center gap-3 rounded-lg border border-border bg-white px-4 py-3 transition-colors hover:bg-gray-50/50">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">
                            {formatCurrency(p.amount)}
                          </span>
                          <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColor(p.status)}`}>
                            {p.status}
                          </span>
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                            {PAYMENT_TYPES.find((t) => t.value === p.type)?.label || p.type.replace(/_/g, " ")}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted">
                          <span>
                            {new Date(p.createdAt).toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          <span>&middot; by {p.recordedBy.name}</span>
                          {p.notes && <span>&middot; {p.notes}</span>}
                        </div>
                      </div>
                      {canManagePayments && (
                        <div className="flex shrink-0 gap-1">
                          <button
                            onClick={() => startEdit(p)}
                            className="rounded-md px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeletePayment(p.id)}
                            className="rounded-md px-2.5 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
