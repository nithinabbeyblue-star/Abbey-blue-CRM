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
  const [paidLocal, setPaid] = useState(paidAmount);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });

  // Payment records state
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    type: "",
    status: "PAID",
    notes: "",
  });
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [selectedPaymentType, setSelectedPaymentType] = useState("");

  const vat = calcVat(ablFeeLocal);
  const total = calcTotal(ablFeeLocal, govFeeLocal, null, adsFeeLocal);
  const due = calcDue(total, paidLocal);

  const hasChanges =
    ablFeeLocal !== ablFee ||
    govFeeLocal !== govFee ||
    adsFeeLocal !== adsFee ||
    paidLocal !== paidAmount;

  const canEdit = canEditFees || canEditPaidAmount;

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

  async function handleSave() {
    setSaving(true);
    setMessage({ text: "", type: "" });

    try {
      const body: Record<string, unknown> = {};
      if (canEditFees) {
        if (ablFeeLocal !== ablFee) body.ablFee = ablFeeLocal;
        if (govFeeLocal !== govFee) body.govFee = govFeeLocal;
        if (adsFeeLocal !== adsFee) body.adsFee = adsFeeLocal;
      }
      if (canEditPaidAmount && paidLocal !== paidAmount) {
        body.paidAmount = paidLocal;
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

      // Auto-create payment record when paid amount changes
      if (canEditPaidAmount && paidLocal !== paidAmount) {
        const diff = paidLocal - paidAmount;
        if (diff !== 0) {
          const payRes = await fetch(`/api/tickets/${ticketId}/payments`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              amount: Math.abs(diff),
              type: selectedPaymentType || "OTHER",
              status: "PAID",
              notes: "Auto-recorded from paid amount update",
            }),
          });
          if (!payRes.ok) {
            const payErr = await payRes.json();
            console.error("Auto-payment failed:", payErr);
          }
        }
      }

      await fetchPayments();
      setMessage({ text: "Financials saved", type: "success" });
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : "Save failed",
        type: "error",
      });
    }

    setSaving(false);
  }

  function resetPaymentForm() {
    setPaymentForm({ amount: "", type: "", status: "PAID", notes: "" });
    setEditingPayment(null);
    setShowPaymentForm(false);
  }

  async function handlePaymentSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPaymentSaving(true);

    try {
      if (editingPayment) {
        const res = await fetch(`/api/tickets/${ticketId}/payments`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentId: editingPayment.id,
            amount: parseFloat(paymentForm.amount),
            type: paymentForm.type,
            status: paymentForm.status,
            notes: paymentForm.notes,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to update payment");
        }
      } else {
        const res = await fetch(`/api/tickets/${ticketId}/payments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: parseFloat(paymentForm.amount),
            type: paymentForm.type,
            status: paymentForm.status,
            notes: paymentForm.notes,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to create payment");
        }
      }

      resetPaymentForm();
      await fetchPayments();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Payment failed");
    }

    setPaymentSaving(false);
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

  function startEdit(p: Payment) {
    setEditingPayment(p);
    setPaymentForm({
      amount: String(p.amount),
      type: p.type,
      status: p.status,
      notes: p.notes || "",
    });
    setShowPaymentForm(true);
  }

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      PAID: "bg-green-100 text-green-700",
      PENDING: "bg-yellow-100 text-yellow-700",
      REFUNDED: "bg-red-100 text-red-700",
    };
    return colors[status] || "bg-gray-100 text-gray-700";
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">
        Financials
      </h2>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
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

        {/* ADS Fee */}
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">ADS Fee</label>
          {canEditFees ? (
            <input
              type="number"
              step="0.01"
              min="0"
              value={adsFeeLocal ?? ""}
              onChange={(e) => setAdsFee(parseNum(e.target.value))}
              placeholder="0.00"
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
            />
          ) : (
            <p className="py-2 text-sm font-medium text-foreground">
              {adsFeeLocal != null ? formatCurrency(adsFeeLocal) : "—"}
            </p>
          )}
        </div>

        {/* Payment Type */}
        {canManagePayments && (
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Payment Type</label>
            <select
              value={selectedPaymentType}
              onChange={(e) => setSelectedPaymentType(e.target.value)}
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option value="" disabled>Select an option</option>
              {PAYMENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* VAT (23%) */}
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">VAT (23%) <span className="font-normal">in ABL</span></label>
          <p className="py-2 text-sm font-medium text-foreground">
            {formatCurrency(vat)}
          </p>
        </div>

        {/* Total */}
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

      {/* Due Amount */}
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

      {/* Payment Records Section */}
      <div className="mt-6 border-t border-border pt-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">
            Payment Records
          </h3>
          {canManagePayments && (
            <button
              onClick={() => {
                resetPaymentForm();
                setShowPaymentForm(true);
              }}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-hover"
            >
              + Record Payment
            </button>
          )}
        </div>

        {/* Payment Form (create or edit) */}
        {showPaymentForm && canManagePayments && (
          <form onSubmit={handlePaymentSubmit} className="mt-3 rounded-lg border border-border bg-gray-50 p-4">
            <p className="mb-3 text-xs font-semibold text-foreground">
              {editingPayment ? "Edit Payment" : "New Payment"}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs text-muted">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Type</label>
                <select
                  value={paymentForm.type}
                  onChange={(e) => setPaymentForm((f) => ({ ...f, type: e.target.value }))}
                  required
                  className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
                >
                  <option value="" disabled>Select an option</option>
                  {PAYMENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Notes</label>
                <input
                  type="text"
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Optional"
                  className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="submit"
                disabled={paymentSaving || !paymentForm.amount || !paymentForm.type}
                className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
              >
                {paymentSaving ? "Saving..." : editingPayment ? "Update" : "Save"}
              </button>
              <button
                type="button"
                onClick={resetPaymentForm}
                className="rounded-lg border border-border px-4 py-2 text-xs font-medium text-foreground transition-colors hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Payment List */}
        {loadingPayments ? (
          <p className="mt-3 text-xs text-muted">Loading payments...</p>
        ) : payments.length === 0 ? (
          <p className="mt-3 text-xs text-muted">No payment records yet.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {payments.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-white px-4 py-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {formatCurrency(p.amount)}
                    </span>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${statusBadge(p.status)}`}>
                      {p.status}
                    </span>
                    <span className="text-xs text-muted">
                      {PAYMENT_TYPES.find((t) => t.value === p.type)?.label || p.type}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted">
                    <span>
                      {new Date(p.createdAt).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                    <span>by {p.recordedBy.name}</span>
                    {p.notes && <span>— {p.notes}</span>}
                  </div>
                </div>
                {canManagePayments && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => startEdit(p)}
                      className="rounded px-2 py-1 text-xs text-primary transition-colors hover:bg-primary/10"
                      title="Edit"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeletePayment(p.id)}
                      className="rounded px-2 py-1 text-xs text-red-600 transition-colors hover:bg-red-50"
                      title="Delete"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
