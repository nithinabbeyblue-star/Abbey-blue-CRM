"use client";

import Link from "next/link";
import { CaseBadge } from "@/components/ui/case-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { AdsBadge } from "@/components/ui/ads-badge";
import { ExpiryBadge } from "@/components/ui/expiry-badge";

interface CaseHeaderProps {
  refNumber: string;
  clientName: string;
  caseType: string | null;
  status: string;
  caseOwner: { name: string } | null;
  caseWorker: { name: string } | null;
  createdAt?: string | null;
  caseDeadline?: string | null;
  caseEndDate?: string | null;
  adsFinishingDate?: string | null;
  visaExpiryDate?: string | null;
  backHref: string;
}

function getUrgencyLevel(deadline: string | null) {
  if (!deadline) return null;
  const now = new Date();
  const dl = new Date(deadline);
  const diffMs = dl.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const formatted = dl.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  if (diffDays < 0) {
    return { label: formatted, daysText: `${Math.abs(diffDays)}d overdue`, level: "overdue" as const };
  }
  if (diffHours <= 24) {
    return { label: formatted, daysText: diffDays === 0 ? "Due today" : "1d left", level: "urgent" as const };
  }
  if (diffHours <= 72) {
    return { label: formatted, daysText: `${diffDays}d left`, level: "warning" as const };
  }
  return { label: formatted, daysText: `${diffDays}d left`, level: "normal" as const };
}

const DEADLINE_STYLES = {
  normal: "border-gray-200 bg-gray-50 text-gray-700",
  warning: "border-amber-300 bg-amber-50 text-amber-800",
  urgent: "animate-urgency-pulse border-red-400 bg-red-50 text-red-800",
  overdue: "animate-urgency-pulse border-red-500 bg-red-100 text-red-900",
};

export function CaseHeader({
  refNumber,
  clientName,
  caseType,
  status,
  caseOwner,
  caseWorker,
  createdAt,
  caseDeadline,
  caseEndDate,
  adsFinishingDate,
  visaExpiryDate,
  backHref,
}: CaseHeaderProps) {
  const deadline = getUrgencyLevel(caseDeadline ?? null);

  return (
    <div className="z-30 flex-shrink-0 border-b border-border bg-white/95 px-4 pb-3 pt-4 backdrop-blur-sm sm:px-6 lg:px-8">
      <div className="mb-2">
        <Link href={backHref} className="text-sm text-muted hover:text-primary">
          &larr; Back
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4">
        {/* Left — Case identity */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="truncate text-xl font-bold text-foreground">{clientName}</h1>
            {visaExpiryDate && (
              <ExpiryBadge expiryDate={visaExpiryDate} label="Visa/IRP Expiry" size="sm" />
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-primary">{refNumber}</span>
            <CaseBadge caseType={caseType} />
            <StatusBadge status={status} size="sm" />
            <span className="text-xs text-muted">
              Owner: <span className="font-medium text-foreground">{caseOwner?.name ?? "—"}</span>
            </span>
            <span className="text-xs text-muted">
              Worker: <span className="font-medium text-foreground">{caseWorker?.name ?? "Unassigned"}</span>
            </span>
            {createdAt && (
              <span className="text-xs text-muted">
                Created {new Date(createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
              </span>
            )}
          </div>
        </div>

        {/* Right — Deadline + ADS badge */}
        <div className="hidden flex-shrink-0 items-center gap-2 lg:flex">
          {adsFinishingDate && <AdsBadge adsFinishingDate={adsFinishingDate} />}
          {deadline && (
            <div className={`flex items-center gap-2 rounded-lg border-2 px-3 py-1.5 ${DEADLINE_STYLES[deadline.level]}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-bold whitespace-nowrap">
                {deadline.label}
              </span>
              <span className="text-xs font-semibold opacity-80 whitespace-nowrap">
                {deadline.daysText}
              </span>
              {(deadline.level === "urgent" || deadline.level === "overdue") && (
                <span className="rounded-full bg-white/60 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                  {deadline.level === "overdue" ? "Overdue" : "Due Soon"}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mobile — Deadline + ADS below header */}
      {(deadline || adsFinishingDate) && (
        <div className="mt-2 flex flex-wrap items-center gap-2 lg:hidden">
          {adsFinishingDate && <AdsBadge adsFinishingDate={adsFinishingDate} />}
          {deadline && (
            <div className={`flex items-center gap-1.5 rounded-lg border-2 px-2.5 py-1 text-xs ${DEADLINE_STYLES[deadline.level]}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-bold">{deadline.label}</span>
              <span className="font-semibold opacity-80">{deadline.daysText}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
