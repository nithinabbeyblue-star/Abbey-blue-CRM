"use client";

import { AdsBadge } from "@/components/ui/ads-badge";

interface DeadlineHeaderProps {
  caseDeadline: string | null;
  adsFinishingDate: string | null;
}

function getUrgencyLevel(deadline: string | null): {
  label: string;
  daysText: string;
  level: "normal" | "warning" | "urgent" | "overdue";
  diffHours: number;
} | null {
  if (!deadline) return null;
  const now = new Date();
  const dl = new Date(deadline);
  const diffMs = dl.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const formatted = dl.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  if (diffDays < 0) {
    return { label: formatted, daysText: `${Math.abs(diffDays)}d overdue`, level: "overdue", diffHours };
  }
  if (diffHours <= 24) {
    return { label: formatted, daysText: diffDays === 0 ? "Due today" : "1d left", level: "urgent", diffHours };
  }
  if (diffHours <= 72) {
    return { label: formatted, daysText: `${diffDays}d left`, level: "warning", diffHours };
  }
  return { label: formatted, daysText: `${diffDays}d left`, level: "normal", diffHours };
}

const URGENCY_STYLES = {
  normal: "border-gray-200 bg-gray-50 text-gray-700",
  warning: "border-amber-300 bg-amber-50 text-amber-800",
  urgent: "animate-urgency-pulse border-red-400 bg-red-50 text-red-800",
  overdue: "animate-urgency-pulse border-red-500 bg-red-100 text-red-900",
};

const URGENCY_ICON_STYLES = {
  normal: "text-gray-500",
  warning: "text-amber-600",
  urgent: "text-red-600",
  overdue: "text-red-700",
};

export function DeadlineHeader({ caseDeadline, adsFinishingDate }: DeadlineHeaderProps) {
  const info = getUrgencyLevel(caseDeadline);

  if (!info && !adsFinishingDate) return null;

  return (
    <div className="space-y-2">
      {info && (
        <div className={`flex items-center gap-2.5 rounded-xl border-2 px-4 py-3 ${URGENCY_STYLES[info.level]}`}>
          <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 flex-shrink-0 ${URGENCY_ICON_STYLES[info.level]}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">
              {info.level === "overdue" ? "OVERDUE" : "Deadline"}: {info.label}
            </p>
            <p className="text-xs font-medium opacity-80">{info.daysText}</p>
          </div>
          {(info.level === "urgent" || info.level === "overdue") && (
            <span className="flex-shrink-0 rounded-full bg-white/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
              {info.level === "overdue" ? "Action Required" : "Due Soon"}
            </span>
          )}
        </div>
      )}
      {adsFinishingDate && (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5">
          <span className="text-xs font-medium text-muted">ADS Status:</span>
          <AdsBadge adsFinishingDate={adsFinishingDate} />
        </div>
      )}
    </div>
  );
}
