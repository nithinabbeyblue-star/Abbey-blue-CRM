"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CaseDropdown } from "@/components/ui/case-dropdown";
import type { CaseTypeKey } from "@/constants/cases";
import { calcVat, calcTotal, calcDue, formatCurrency } from "@/constants/finance";

const PRIORITIES = [
  { value: 0, label: "Normal" },
  { value: 1, label: "High" },
  { value: 2, label: "Urgent" },
];

const PAYMENT_TYPES = [
  { value: "INITIAL_PAYMENT", label: "Initial Payment" },
  { value: "FINAL_PAYMENT", label: "Final Payment" },
  { value: "OTHER", label: "Other" },
];

type FieldErrors = Record<string, string>;

export function NewTicketForm({ basePath }: { basePath: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [caseType, setCaseType] = useState<CaseTypeKey | null>(null);
  const [ablFee, setAblFee] = useState<number | null>(null);
  const [govFee, setGovFee] = useState<number | null>(null);
  const [adsFee, setAdsFee] = useState<number | null>(null);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [paymentType, setPaymentType] = useState("INITIAL_PAYMENT");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [attempted, setAttempted] = useState(false);
  const [duplicates, setDuplicates] = useState<Array<{
    id: string; refNumber: string; clientName: string;
    clientPhone: string; clientEmail: string | null; status: string;
  }>>([]);
  const [duplicateDismissed, setDuplicateDismissed] = useState(false);

  const total = calcTotal(ablFee, govFee, null, adsFee);
  const amountDue = calcDue(total, paidAmount);

  function validate(formData: FormData): FieldErrors {
    const errors: FieldErrors = {};
    const clientName = (formData.get("clientName") as string)?.trim();
    const clientPhone = (formData.get("clientPhone") as string)?.trim();
    const clientEmail = (formData.get("clientEmail") as string)?.trim();
    const gender = (formData.get("gender") as string)?.trim();
    const nationality = (formData.get("nationality") as string)?.trim();
    const address = (formData.get("address") as string)?.trim();
    const caseStartDate = (formData.get("caseStartDate") as string)?.trim();

    if (!clientName) errors.clientName = "Full name is required";
    if (!clientPhone) errors.clientPhone = "Phone number is required";
    if (!clientEmail) errors.clientEmail = "Email is required";
    if (!gender) errors.gender = "Gender is required";
    if (!nationality) errors.nationality = "Nationality is required";
    if (!address) errors.address = "Address is required";
    if (!caseType) errors.caseType = "Case type is required";
    if (!caseStartDate) errors.caseStartDate = "Case start date is required";
    if (ablFee == null) errors.ablFee = "ABL Fee is required";
    if (govFee == null) errors.govFee = "Gov Fee is required";
    if (adsFee == null) errors.adsFee = "ADS Fee is required";

    return errors;
  }

  async function checkDuplicates(phone: string, email: string) {
    if ((!phone || phone.length < 6) && (!email || !email.includes("@"))) return;
    try {
      const res = await fetch("/api/governance/duplicates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone || undefined, email: email || undefined }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.matches?.length > 0) {
          setDuplicates(data.matches);
          setDuplicateDismissed(false);
        } else {
          setDuplicates([]);
        }
      }
    } catch {
      // Silently fail — duplicate check is non-blocking
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setAttempted(true);

    const formData = new FormData(e.currentTarget);
    const errors = validate(formData);
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      setError("Please fill in all required fields before creating a case.");
      setLoading(false);
      return;
    }

    setLoading(true);

    const body: Record<string, unknown> = {
      clientName: (formData.get("clientName") as string).trim(),
      clientEmail: (formData.get("clientEmail") as string).trim(),
      clientPhone: (formData.get("clientPhone") as string).trim(),
      gender: (formData.get("gender") as string).trim(),
      nationality: (formData.get("nationality") as string).trim(),
      address: (formData.get("address") as string).trim(),
      caseType: caseType,
      source: formData.get("source") as string,
      priority: parseInt(formData.get("priority") as string, 10),
      notes: formData.get("notes") as string,
      caseStartDate: (formData.get("caseStartDate") as string).trim(),
      ablFee,
      govFee,
      adsFee,
      paidAmount,
      paymentType: paidAmount > 0 ? paymentType : undefined,
    };
    const caseEndDate = (formData.get("caseEndDate") as string)?.trim();
    if (caseEndDate) body.caseEndDate = caseEndDate;

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

      router.push(`${basePath}/${data.ticket.id}`);
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

  const finInputClass = (field: string) =>
    `w-full rounded-lg border bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 ${
      attempted && fieldErrors[field]
        ? "border-red-400 focus:border-red-500 focus:ring-red-200"
        : "border-border focus:border-primary focus:ring-primary/20"
    }`;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold text-foreground">Create New Case</h1>
      <p className="mt-1 text-sm text-muted">
        Fill in all required fields to create a new client case.
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
                onBlur={(e) => {
                  const form = e.target.form;
                  const email = (form?.elements.namedItem("clientEmail") as HTMLInputElement)?.value || "";
                  checkDuplicates(e.target.value, email);
                }}
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
                onBlur={(e) => {
                  const form = e.target.form;
                  const phone = (form?.elements.namedItem("clientPhone") as HTMLInputElement)?.value || "";
                  checkDuplicates(phone, e.target.value);
                }}
              />
              {attempted && fieldErrors.clientEmail && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.clientEmail}</p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Gender <span className="text-danger">*</span>
              </label>
              <select
                name="gender"
                defaultValue=""
                className={inputClass("gender")}
              >
                <option value="" disabled>Select gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
              {attempted && fieldErrors.gender && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.gender}</p>
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
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Address <span className="text-danger">*</span>
              </label>
              <textarea
                name="address"
                rows={2}
                placeholder="Full address including city and postcode"
                className={inputClass("address")}
              />
              {attempted && fieldErrors.address && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.address}</p>
              )}
            </div>
          </div>
        </div>

        {/* Duplicate Warning */}
        {duplicates.length > 0 && !duplicateDismissed && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <h3 className="text-sm font-semibold text-amber-800">Potential Duplicate Detected</h3>
              </div>
              <button
                type="button"
                onClick={() => setDuplicateDismissed(true)}
                className="text-xs font-medium text-amber-600 hover:text-amber-800"
              >
                Dismiss
              </button>
            </div>
            <p className="mt-2 text-xs text-amber-700">
              The following existing tickets match the phone number or email you entered:
            </p>
            <div className="mt-3 space-y-2">
              {duplicates.map((d) => (
                <div key={d.id} className="flex items-center justify-between rounded-lg border border-amber-200 bg-white px-4 py-2.5">
                  <div>
                    <span className="text-sm font-medium text-foreground">{d.clientName}</span>
                    <span className="mx-2 text-muted">|</span>
                    <span className="text-xs text-muted">{d.clientPhone}</span>
                    {d.clientEmail && <span className="ml-2 text-xs text-muted">{d.clientEmail}</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-amber-700">{d.refNumber}</span>
                    <a
                      href={`${basePath}/${d.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      View
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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
            <div className="grid grid-cols-2 gap-4">
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
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Case End Date
                </label>
                <input
                  name="caseEndDate"
                  type="date"
                  className="w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Financials */}
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-6 py-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
              Financial Information
            </h2>
          </div>
          <div className="p-6">
            {/* Fee Inputs */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  ABL Fee <span className="font-normal text-muted">(incl. 23% VAT)</span> <span className="text-danger">*</span>
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">&#8364;</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={ablFee ?? ""}
                    onChange={(e) => setAblFee(e.target.value === "" ? null : parseFloat(e.target.value))}
                    placeholder="0.00"
                    className={`pl-7 ${finInputClass("ablFee")}`}
                  />
                </div>
                {attempted && fieldErrors.ablFee && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.ablFee}</p>
                )}
                {ablFee != null && ablFee > 0 && (
                  <p className="mt-1 text-[11px] text-muted">
                    Net: {formatCurrency(ablFee - calcVat(ablFee))} &middot; VAT: {formatCurrency(calcVat(ablFee))}
                  </p>
                )}
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Gov Fee <span className="text-danger">*</span>
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">&#8364;</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={govFee ?? ""}
                    onChange={(e) => setGovFee(e.target.value === "" ? null : parseFloat(e.target.value))}
                    placeholder="0.00"
                    className={`pl-7 ${finInputClass("govFee")}`}
                  />
                </div>
                {attempted && fieldErrors.govFee && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.govFee}</p>
                )}
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  ADS Fee <span className="text-danger">*</span>
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">&#8364;</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={adsFee ?? ""}
                    onChange={(e) => setAdsFee(e.target.value === "" ? null : parseFloat(e.target.value))}
                    placeholder="0.00"
                    className={`pl-7 ${finInputClass("adsFee")}`}
                  />
                </div>
                {attempted && fieldErrors.adsFee && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.adsFee}</p>
                )}
              </div>
            </div>

            {/* Initial Payment */}
            <div className="mt-5 rounded-lg border border-dashed border-border bg-gray-50/50 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Initial Payment (Optional)</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    Payment Type
                  </label>
                  <select
                    value={paymentType}
                    onChange={(e) => setPaymentType(e.target.value)}
                    className="w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  >
                    {PAYMENT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    Amount Paid
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">&#8364;</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={paidAmount || ""}
                      onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      className="w-full rounded-lg border border-border bg-white py-2.5 pl-7 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Live Summary */}
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-border bg-gray-50 p-3">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted">VAT (23%)</p>
                <p className="mt-1 text-base font-semibold text-foreground">
                  {formatCurrency(ablFee != null && ablFee > 0 ? calcVat(ablFee) : 0)}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-gray-50 p-3">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted">Total</p>
                <p className="mt-1 text-base font-bold text-foreground">{formatCurrency(total)}</p>
              </div>
              <div className="rounded-lg border border-border bg-gray-50 p-3">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted">Paid</p>
                <p className="mt-1 text-base font-semibold text-green-600">{formatCurrency(paidAmount)}</p>
              </div>
              <div className={`rounded-lg border p-3 ${amountDue > 0 ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"}`}>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted">Due</p>
                <p className={`mt-1 text-base font-bold ${amountDue > 0 ? "text-red-600" : "text-green-600"}`}>
                  {formatCurrency(amountDue)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Lead Info */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">
            Lead Info
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Contacted By <span className="text-danger">*</span>
              </label>
              <select
                name="source"
                required
                defaultValue="WHATSAPP"
                className="w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                <optgroup label="Social Media">
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="TIKTOK">TikTok</option>
                </optgroup>
                <optgroup label="Direct">
                  <option value="WALK_IN">Walk-in</option>
                  <option value="LANDLINE">Landline</option>
                  <option value="REFERRAL">Referral</option>
                  <option value="WEBSITE">Website</option>
                </optgroup>
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
            {loading ? "Creating..." : "Create Case"}
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
