"use client";

import { useState } from "react";
import { CaseDropdown } from "@/components/ui/case-dropdown";
import { CaseBadge } from "@/components/ui/case-badge";
import { AdsBadge } from "@/components/ui/ads-badge";
import type { CaseTypeKey } from "@/constants/cases";

interface EditableDetailsCardProps {
  ticketId: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string | null;
  gender: string | null;
  nationality: string | null;
  address: string | null;
  caseType: string | null;
  source: string;
  caseStartDate?: string | null;
  caseEndDate?: string | null;
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

const SOURCE_LABELS: Record<string, string> = {
  WHATSAPP: "WhatsApp",
  TIKTOK: "TikTok",
  WALK_IN: "Walk-in",
  REFERRAL: "Referral",
  WEBSITE: "Website",
  WEBHOOK: "Webhook",
  LANDLINE: "Landline",
};

export function EditableDetailsCard({
  ticketId,
  clientName,
  clientPhone,
  clientEmail,
  gender,
  nationality,
  address,
  caseType,
  source,
  caseStartDate,
  caseEndDate,
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
  const [gen, setGen] = useState(gender || "");
  const [nat, setNat] = useState(nationality || "");
  const [addr, setAddr] = useState(address || "");
  const [ct, setCt] = useState<CaseTypeKey | null>(caseType as CaseTypeKey | null);
  const [src, setSrc] = useState(source);
  const [startDate, setStartDate] = useState(caseStartDate ? caseStartDate.slice(0, 10) : "");
  const [endDate, setEndDate] = useState(caseEndDate ? caseEndDate.slice(0, 10) : "");
  const [adsDate, setAdsDate] = useState(adsFinishingDate ? adsFinishingDate.slice(0, 10) : "");
  const [deadline, setDeadline] = useState(caseDeadline ? caseDeadline.slice(0, 10) : "");

  function handleCancel() {
    setName(clientName);
    setPhone(clientPhone);
    setEmail(clientEmail || "");
    setGen(gender || "");
    setNat(nationality || "");
    setAddr(address || "");
    setCt(caseType as CaseTypeKey | null);
    setSrc(source);
    setStartDate(caseStartDate ? caseStartDate.slice(0, 10) : "");
    setEndDate(caseEndDate ? caseEndDate.slice(0, 10) : "");
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
      if (gen !== (gender || "")) body.gender = gen || null;
      if (nat !== (nationality || "")) body.nationality = nat || null;
      if (addr !== (address || "")) body.address = addr || null;
      if (ct !== caseType) body.caseType = ct;
      if (src !== source) body.source = src;
      if (startDate !== (caseStartDate ? caseStartDate.slice(0, 10) : ""))
        body.caseStartDate = startDate || null;
      if (endDate !== (caseEndDate ? caseEndDate.slice(0, 10) : ""))
        body.caseEndDate = endDate || null;
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
            <dt className="text-xs font-medium text-muted">Gender</dt>
            <dd className="mt-1 text-foreground">{gender || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted">Nationality</dt>
            <dd className="mt-1 text-foreground">{nationality || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted">Contacted By</dt>
            <dd className="mt-1 text-foreground">{SOURCE_LABELS[source] || source.replace(/_/g, " ")}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted">Case Type</dt>
            <dd className="mt-1 text-foreground">
              <CaseBadge caseType={caseType} />
              {!caseType && "—"}
            </dd>
          </div>
        </dl>

        {/* Address — prominent */}
        {address && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <dt className="text-xs font-medium text-amber-700">
              Address
              <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800">Important</span>
            </dt>
            <dd className="mt-1 text-sm text-foreground">{address}</dd>
          </div>
        )}
        {!address && (
          <div className="mt-4">
            <dt className="text-xs font-medium text-muted">Address</dt>
            <dd className="mt-1 text-sm text-muted">—</dd>
          </div>
        )}

        {/* Date Fields */}
        <div className="mt-4 border-t border-border pt-4">
          <div className="grid grid-cols-1 gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted">Case Start Date</span>
              <span className="text-sm text-foreground">{formatDate(caseStartDate)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted">Case End Date</span>
              <span className="text-sm text-foreground">{formatDate(caseEndDate)}</span>
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
          <label className="mb-1 block text-xs font-medium text-muted">Gender</label>
          <select
            value={gen}
            onChange={(e) => setGen(e.target.value)}
            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
          >
            <option value="">Select gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
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
          <label className="mb-1 block text-xs font-medium text-muted">Contacted By</label>
          <select
            value={src}
            onChange={(e) => setSrc(e.target.value)}
            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
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
              <option value="WEBHOOK">Webhook</option>
            </optgroup>
          </select>
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-xs font-medium text-muted">
            Address
            <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">Important</span>
          </label>
          <textarea
            rows={2}
            value={addr}
            onChange={(e) => setAddr(e.target.value)}
            placeholder="Full address including city and postcode"
            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* Date Fields in Edit Mode */}
      <div className="mt-4 border-t border-border pt-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Dates</h3>
        <div className="grid grid-cols-2 gap-4">
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
            <label className="mb-1 block text-xs font-medium text-muted">Case End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
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
