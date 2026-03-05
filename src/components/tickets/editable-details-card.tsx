"use client";

import { useState } from "react";
import { CaseDropdown } from "@/components/ui/case-dropdown";
import { CaseBadge } from "@/components/ui/case-badge";
import { AdsBadge } from "@/components/ui/ads-badge";
import type { CaseTypeKey } from "@/constants/cases";

const SOURCES = [
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "TIKTOK", label: "TikTok" },
  { value: "WALK_IN", label: "Walk-in" },
  { value: "REFERRAL", label: "Referral" },
  { value: "WEBSITE", label: "Website" },
  { value: "WEBHOOK", label: "Webhook" },
];

interface EditableDetailsCardProps {
  ticketId: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string | null;
  nationality: string | null;
  caseType: string | null;
  destination: string | null;
  source: string;
  caseStartDate?: string | null;
  adsFinishingDate?: string | null;
  caseDeadline?: string | null;
  onSaved: () => void;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function EditableDetailsCard({
  ticketId,
  clientName,
  clientPhone,
  clientEmail,
  nationality,
  caseType,
  destination,
  source,
  caseStartDate,
  adsFinishingDate,
  caseDeadline,
  onSaved,
}: EditableDetailsCardProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });

  // Local edit state
  const [name, setName] = useState(clientName);
  const [phone, setPhone] = useState(clientPhone);
  const [email, setEmail] = useState(clientEmail || "");
  const [nat, setNat] = useState(nationality || "");
  const [ct, setCt] = useState<CaseTypeKey | null>(caseType as CaseTypeKey | null);
  const [dest, setDest] = useState(destination || "");
  const [src, setSrc] = useState(source);
  const [startDate, setStartDate] = useState(caseStartDate ? caseStartDate.slice(0, 10) : "");
  const [adsDate, setAdsDate] = useState(adsFinishingDate ? adsFinishingDate.slice(0, 10) : "");
  const [deadline, setDeadline] = useState(caseDeadline ? caseDeadline.slice(0, 10) : "");

  function handleCancel() {
    setName(clientName);
    setPhone(clientPhone);
    setEmail(clientEmail || "");
    setNat(nationality || "");
    setCt(caseType as CaseTypeKey | null);
    setDest(destination || "");
    setSrc(source);
    setStartDate(caseStartDate ? caseStartDate.slice(0, 10) : "");
    setAdsDate(adsFinishingDate ? adsFinishingDate.slice(0, 10) : "");
    setDeadline(caseDeadline ? caseDeadline.slice(0, 10) : "");
    setEditing(false);
    setMessage({ text: "", type: "" });
  }

  async function handleSave() {
    if (!name.trim() || !phone.trim()) {
      setMessage({ text: "Name and phone are required", type: "error" });
      return;
    }

    setSaving(true);
    setMessage({ text: "", type: "" });

    try {
      const body: Record<string, unknown> = {};
      if (name !== clientName) body.clientName = name;
      if (phone !== clientPhone) body.clientPhone = phone;
      if (email !== (clientEmail || "")) body.clientEmail = email || null;
      if (nat !== (nationality || "")) body.nationality = nat || null;
      if (ct !== caseType) body.caseType = ct;
      if (dest !== (destination || "")) body.destination = dest || null;
      if (src !== source) body.source = src;
      if (startDate !== (caseStartDate ? caseStartDate.slice(0, 10) : ""))
        body.caseStartDate = startDate || null;
      if (adsDate !== (adsFinishingDate ? adsFinishingDate.slice(0, 10) : ""))
        body.adsFinishingDate = adsDate || null;
      if (deadline !== (caseDeadline ? caseDeadline.slice(0, 10) : ""))
        body.caseDeadline = deadline || null;

      if (Object.keys(body).length === 0) {
        setEditing(false);
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
        throw new Error(data.error || "Failed to save");
      }

      setMessage({ text: "Details updated", type: "success" });
      setEditing(false);
      onSaved();
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "Save failed", type: "error" });
    }

    setSaving(false);
  }

  if (!editing) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
            Client & Case Details
          </h2>
          <button
            onClick={() => setEditing(true)}
            className="text-xs font-medium text-primary hover:underline"
          >
            Edit
          </button>
        </div>
        {message.text && (
          <div className={`mb-3 rounded-lg px-3 py-2 text-xs ${message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
            {message.text}
          </div>
        )}
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-xs font-medium text-muted">Full Name</dt>
            <dd className="mt-1 font-medium text-foreground">{clientName}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted">Phone</dt>
            <dd className="mt-1 text-foreground">{clientPhone}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted">Email</dt>
            <dd className="mt-1 text-foreground">{clientEmail || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted">Nationality</dt>
            <dd className="mt-1 text-foreground">{nationality || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted">Case Type</dt>
            <dd className="mt-1 text-foreground">
              <CaseBadge caseType={caseType} />
              {!caseType && "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted">Destination</dt>
            <dd className="mt-1 text-foreground">{destination || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted">Source</dt>
            <dd className="mt-1 text-foreground">{source.replace(/_/g, " ")}</dd>
          </div>
        </dl>

        {/* Date Fields */}
        <div className="mt-4 border-t border-border pt-4">
          <div className="grid grid-cols-1 gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted">Case Start Date</span>
              <span className="text-sm text-foreground">{formatDate(caseStartDate)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted">ADS Finishing Date</span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-foreground">{formatDate(adsFinishingDate)}</span>
                <AdsBadge adsFinishingDate={adsFinishingDate ?? null} />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted">Case Deadline</span>
              <span className="text-sm text-foreground">{formatDate(caseDeadline)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Edit mode
  return (
    <div className="rounded-xl border-2 border-primary/30 bg-card p-6 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">
        Edit Details
      </h2>
      {message.text && (
        <div className={`mb-3 rounded-lg px-3 py-2 text-xs ${message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {message.text}
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">
            Full Name <span className="text-red-500">*</span>
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">
            Phone <span className="text-red-500">*</span>
          </label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Nationality</label>
          <input
            value={nat}
            onChange={(e) => setNat(e.target.value)}
            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Case Type</label>
          <CaseDropdown value={ct} onChange={setCt} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Destination</label>
          <input
            value={dest}
            onChange={(e) => setDest(e.target.value)}
            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Source</label>
          <select
            value={src}
            onChange={(e) => setSrc(e.target.value)}
            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
          >
            {SOURCES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Date Fields in Edit Mode */}
      <div className="mt-4 border-t border-border pt-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Dates</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Case Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">ADS Finishing Date</label>
            <input
              type="date"
              value={adsDate}
              onChange={(e) => setAdsDate(e.target.value)}
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
            />
            {adsDate && (
              <div className="mt-1">
                <AdsBadge adsFinishingDate={adsDate} />
              </div>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Case Deadline</label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
        <button
          onClick={handleCancel}
          disabled={saving}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
