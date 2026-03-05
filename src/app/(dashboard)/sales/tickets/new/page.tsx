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

type FieldErrors = Record<string, string>;

export default function NewTicketPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [caseType, setCaseType] = useState<CaseTypeKey | null>(null);
  const [ablFee, setAblFee] = useState<number | null>(null);
  const [govFee, setGovFee] = useState<number | null>(null);
  const [adverts, setAdverts] = useState<number | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [attempted, setAttempted] = useState(false);

  function validate(formData: FormData): FieldErrors {
    const errors: FieldErrors = {};
    const clientName = (formData.get("clientName") as string)?.trim();
    const clientPhone = (formData.get("clientPhone") as string)?.trim();
    const clientEmail = (formData.get("clientEmail") as string)?.trim();
    const nationality = (formData.get("nationality") as string)?.trim();
    const destination = (formData.get("destination") as string)?.trim();
    const caseStartDate = (formData.get("caseStartDate") as string)?.trim();

    if (!clientName) errors.clientName = "Full name is required";
    if (!clientPhone) errors.clientPhone = "Phone number is required";
    if (!clientEmail) errors.clientEmail = "Email is required";
    if (!nationality) errors.nationality = "Nationality is required";
    if (!caseType) errors.caseType = "Case type is required";
    if (!destination) errors.destination = "Destination country is required";
    if (!caseStartDate) errors.caseStartDate = "Case start date is required";

    return errors;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setAttempted(true);

    const formData = new FormData(e.currentTarget);
    const errors = validate(formData);
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      setError("Please fill in all required fields before creating a ticket.");
      setLoading(false);
      return;
    }

    setLoading(true);

    const body: Record<string, unknown> = {
      clientName: (formData.get("clientName") as string).trim(),
      clientEmail: (formData.get("clientEmail") as string).trim(),
      clientPhone: (formData.get("clientPhone") as string).trim(),
      nationality: (formData.get("nationality") as string).trim(),
      caseType: caseType,
      destination: (formData.get("destination") as string).trim(),
      source: formData.get("source") as string,
      priority: parseInt(formData.get("priority") as string, 10),
      notes: formData.get("notes") as string,
      caseStartDate: (formData.get("caseStartDate") as string).trim(),
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

  const inputClass = (field: string) =>
    `w-full rounded-lg border bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 ${
      attempted && fieldErrors[field]
        ? "border-red-400 focus:border-red-500 focus:ring-red-200"
        : "border-border focus:border-primary focus:ring-primary/20"
    }`;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold text-foreground">Create New Ticket</h1>
      <p className="mt-1 text-sm text-muted">
        Fill in all required fields to create a new client ticket.
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
                placeholder="e.g. John Smith"
                className={inputClass("clientName")}
              />
              {attempted && fieldErrors.clientName && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.clientName}</p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Phone Number <span className="text-danger">*</span>
              </label>
              <input
                name="clientPhone"
                placeholder="e.g. +44 7700 900000"
                className={inputClass("clientPhone")}
              />
              {attempted && fieldErrors.clientPhone && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.clientPhone}</p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Email <span className="text-danger">*</span>
              </label>
              <input
                name="clientEmail"
                type="email"
                placeholder="e.g. john@example.com"
                className={inputClass("clientEmail")}
              />
              {attempted && fieldErrors.clientEmail && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.clientEmail}</p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Nationality <span className="text-danger">*</span>
              </label>
              <input
                name="nationality"
                placeholder="e.g. Pakistani"
                className={inputClass("nationality")}
              />
              {attempted && fieldErrors.nationality && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.nationality}</p>
              )}
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
                Case Type <span className="text-danger">*</span>
              </label>
              <div className={attempted && fieldErrors.caseType ? "rounded-lg ring-2 ring-red-200" : ""}>
                <CaseDropdown value={caseType} onChange={setCaseType} />
              </div>
              {attempted && fieldErrors.caseType && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.caseType}</p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Destination Country <span className="text-danger">*</span>
              </label>
              <input
                name="destination"
                placeholder="e.g. Ireland"
                className={inputClass("destination")}
              />
              {attempted && fieldErrors.destination && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.destination}</p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Case Start Date <span className="text-danger">*</span>
              </label>
              <input
                name="caseStartDate"
                type="date"
                className={inputClass("caseStartDate")}
              />
              {attempted && fieldErrors.caseStartDate && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.caseStartDate}</p>
              )}
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
