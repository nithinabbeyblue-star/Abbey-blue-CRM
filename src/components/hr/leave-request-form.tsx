"use client";

import { useState } from "react";

const LEAVE_TYPES = [
  { value: "ANNUAL", label: "Annual Leave" },
  { value: "SICK", label: "Sick Leave" },
  { value: "PERSONAL", label: "Personal Leave" },
  { value: "MATERNITY", label: "Maternity Leave" },
  { value: "PATERNITY", label: "Paternity Leave" },
  { value: "UNPAID", label: "Unpaid Leave" },
  { value: "OTHER", label: "Other" },
] as const;

interface LeaveRequestFormProps {
  onSuccess?: () => void;
}

export function LeaveRequestForm({ onSuccess }: LeaveRequestFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [leaveType, setLeaveType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [medicalFile, setMedicalFile] = useState<File | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function validate(): Record<string, string> {
    const errors: Record<string, string> = {};

    if (!leaveType) errors.leaveType = "Leave type is required";
    if (!startDate) errors.startDate = "Start date is required";
    if (!endDate) errors.endDate = "End date is required";

    if (startDate && endDate && endDate < startDate) {
      errors.endDate = "End date must be on or after the start date";
    }

    return errors;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setAttempted(true);

    const errors = validate();
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/hr/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: leaveType,
          startDate,
          endDate,
          reason: reason.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to submit leave request");
        return;
      }

      setSuccess("Leave request submitted successfully.");
      setLeaveType("");
      setStartDate("");
      setEndDate("");
      setReason("");
      setMedicalFile(null);
      setAttempted(false);
      setFieldErrors({});
      onSuccess?.();
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
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-bold text-foreground">Request Leave</h1>
      <p className="mt-1 text-sm text-muted">
        Submit a leave or holiday request for approval.
      </p>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        {/* Leave Details */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">
            Leave Details
          </h2>
          <div className="grid grid-cols-1 gap-4">
            {/* Leave Type */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Leave Type <span className="text-danger">*</span>
              </label>
              <select
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value)}
                className={inputClass("leaveType")}
              >
                <option value="" disabled>
                  Select leave type
                </option>
                {LEAVE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              {attempted && fieldErrors.leaveType && (
                <p className="mt-1 text-xs text-red-600">
                  {fieldErrors.leaveType}
                </p>
              )}
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Start Date <span className="text-danger">*</span>
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={inputClass("startDate")}
                />
                {attempted && fieldErrors.startDate && (
                  <p className="mt-1 text-xs text-red-600">
                    {fieldErrors.startDate}
                  </p>
                )}
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  End Date <span className="text-danger">*</span>
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate || undefined}
                  className={inputClass("endDate")}
                />
                {attempted && fieldErrors.endDate && (
                  <p className="mt-1 text-xs text-red-600">
                    {fieldErrors.endDate}
                  </p>
                )}
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Reason <span className="text-xs font-normal text-muted">(optional)</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Briefly describe the reason for your leave..."
                className="w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* Medical Report (Sick Leave only) */}
            {leaveType === "SICK" && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Medical Report{" "}
                  <span className="text-xs font-normal text-muted">
                    (optional)
                  </span>
                </label>
                <div className="relative">
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    onChange={(e) =>
                      setMedicalFile(e.target.files?.[0] ?? null)
                    }
                    className="w-full rounded-lg border border-dashed border-border bg-gray-50/50 px-4 py-3 text-sm text-muted file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1 file:text-xs file:font-semibold file:text-white hover:file:bg-primary-hover"
                  />
                </div>
                {medicalFile && (
                  <p className="mt-1.5 text-xs text-muted">
                    Selected: {medicalFile.name}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Submitting..." : "Submit Request"}
          </button>
          <button
            type="button"
            onClick={() => {
              setLeaveType("");
              setStartDate("");
              setEndDate("");
              setReason("");
              setMedicalFile(null);
              setError("");
              setSuccess("");
              setAttempted(false);
              setFieldErrors({});
            }}
            className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-gray-50"
          >
            Reset
          </button>
        </div>
      </form>
    </div>
  );
}
