"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CaseDropdown } from "@/components/ui/case-dropdown";
import type { CaseTypeKey } from "@/constants/cases";
import { calcVat, calcTotal, formatCurrency } from "@/constants/finance";

const SOURCES = [
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "TIKTOK", label: "TikTok" },
  { value: "WALK_IN", label: "Walk-in" },
  { value: "REFERRAL", label: "Referral" },
  { value: "WEBSITE", label: "Website" },
];

const PRIORITIES = [
  { value: 0, label: "Normal" },
  { value: 1, label: "High" },
  { value: 2, label: "Urgent" },
];

export default function NewTicketPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [caseType, setCaseType] = useState<CaseTypeKey | null>(null);
  const [ablFee, setAblFee] = useState<number | null>(null);
  const [govFee, setGovFee] = useState<number | null>(null);
  const [adverts, setAdverts] = useState<number | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {
      clientName: formData.get("clientName") as string,
      clientEmail: formData.get("clientEmail") as string,
      clientPhone: formData.get("clientPhone") as string,
      nationality: formData.get("nationality") as string,
      caseType: caseType,
      destination: formData.get("destination") as string,
      source: formData.get("source") as string,
      priority: parseInt(formData.get("priority") as string, 10),
      notes: formData.get("notes") as string,
    };
    if (ablFee != null) body.ablFee = ablFee;
    if (govFee != null) body.govFee = govFee;
    if (adverts != null) body.adverts = adverts;

    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create ticket");
        return;
      }

      router.push(`/sales/tickets/${data.ticket.id}`);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold text-foreground">Create New Ticket</h1>
      <p className="mt-1 text-sm text-muted">
        Enter the lead details from WhatsApp, TikTok, or walk-in.
      </p>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        {/* Client Details */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">
            Client Information
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Full Name <span className="text-danger">*</span>
              </label>
              <input
                name="clientName"
                required
                placeholder="e.g. John Smith"
                className="w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Phone Number <span className="text-danger">*</span>
              </label>
              <input
                name="clientPhone"
                required
                placeholder="e.g. +44 7700 900000"
                className="w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Email
              </label>
              <input
                name="clientEmail"
                type="email"
                placeholder="e.g. john@example.com"
                className="w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Nationality
              </label>
              <input
                name="nationality"
                placeholder="e.g. Pakistani"
                className="w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
        </div>

        {/* Case Details */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">
            Case Details
          </h2>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Case Type
              </label>
              <CaseDropdown value={caseType} onChange={setCaseType} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Destination Country
              </label>
              <input
                name="destination"
                placeholder="e.g. Ireland"
                className="w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
        </div>

        {/* Financials (optional) */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">
            Financials <span className="font-normal normal-case text-muted">(optional)</span>
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">ABL Fee</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={ablFee ?? ""}
                onChange={(e) => setAblFee(e.target.value === "" ? null : parseFloat(e.target.value))}
                placeholder="0.00"
                className="w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Gov Fee</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={govFee ?? ""}
                onChange={(e) => setGovFee(e.target.value === "" ? null : parseFloat(e.target.value))}
                placeholder="0.00"
                className="w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Adverts</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={adverts ?? ""}
                onChange={(e) => setAdverts(e.target.value === "" ? null : parseFloat(e.target.value))}
                placeholder="0.00"
                className="w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
          {/* Live preview */}
          {(ablFee != null || govFee != null || adverts != null) && (
            <div className="mt-4 flex items-center gap-4 rounded-lg bg-gray-50 px-4 py-3 text-sm">
              {ablFee != null && ablFee > 0 && (
                <span className="text-muted">VAT in ABL: <span className="font-medium text-foreground">{formatCurrency(calcVat(ablFee))}</span></span>
              )}
              <span className="text-muted">Total: <span className="font-bold text-foreground">{formatCurrency(calcTotal(ablFee, govFee, adverts))}</span></span>
            </div>
          )}
        </div>

        {/* Lead Info */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">
            Lead Info
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Lead Source <span className="text-danger">*</span>
              </label>
              <select
                name="source"
                required
                defaultValue="WHATSAPP"
                className="w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                {SOURCES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Priority
              </label>
              <select
                name="priority"
                defaultValue="0"
                className="w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Notes
              </label>
              <textarea
                name="notes"
                rows={3}
                placeholder="Any additional notes about this lead..."
                className="w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create Ticket"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
