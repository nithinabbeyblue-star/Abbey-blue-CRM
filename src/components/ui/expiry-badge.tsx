"use client";

import { useMemo } from "react";
import { Clock, AlertTriangle, ShieldCheck, CalendarClock } from "lucide-react";
import { calculateDeadline, URGENCY_STYLES } from "@/lib/deadlines";

interface ExpiryBadgeProps {
  expiryDate: string | null;
  label?: string;
  size?: "sm" | "md" | "lg";
}

export function ExpiryBadge({ expiryDate, label = "Expires", size = "md" }: ExpiryBadgeProps) {
  const deadline = useMemo(() => calculateDeadline(expiryDate), [expiryDate]);

  if (!deadline) return null;

  const styles = URGENCY_STYLES[deadline.urgency];

  const sizeClasses = {
    sm: "px-2 py-0.5 text-[10px] gap-1",
    md: "px-3 py-1.5 text-xs gap-1.5",
    lg: "px-4 py-2 text-sm gap-2",
  };

  const iconSize = {
    sm: "h-3 w-3",
    md: "h-3.5 w-3.5",
    lg: "h-4 w-4",
  };

  const Icon =
    deadline.urgency === "expired"
      ? AlertTriangle
      : deadline.urgency === "critical" || deadline.urgency === "urgent"
        ? Clock
        : deadline.urgency === "warning"
          ? CalendarClock
          : ShieldCheck;

  const formattedDate = expiryDate
    ? new Date(expiryDate).toLocaleDateString("en-IE", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";

  return (
    <div
      className={`inline-flex items-center rounded-lg border font-semibold ${styles.border} ${styles.bg} ${styles.text} ${sizeClasses[size]}`}
      title={`${label}: ${formattedDate} — ${deadline.label}`}
    >
      <Icon className={`shrink-0 ${iconSize[size]}`} />
      <span>{formattedDate}</span>
      <span className="opacity-70">·</span>
      <span className={deadline.urgency === "critical" || deadline.urgency === "expired" ? "font-bold" : ""}>
        {deadline.daysRemaining <= 0
          ? deadline.daysRemaining === 0
            ? "Today!"
            : `${Math.abs(deadline.daysRemaining)}d overdue`
          : `${deadline.daysRemaining}d left`}
      </span>
    </div>
  );
}

/** Compact inline badge for tables */
export function ExpiryBadgeInline({ expiryDate }: { expiryDate: string | null }) {
  const deadline = useMemo(() => calculateDeadline(expiryDate), [expiryDate]);

  if (!deadline) return <span className="text-xs text-muted">—</span>;

  const styles = URGENCY_STYLES[deadline.urgency];

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${styles.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} />
      {deadline.daysRemaining <= 0
        ? deadline.daysRemaining === 0
          ? "Today"
          : `${Math.abs(deadline.daysRemaining)}d over`
        : `${deadline.daysRemaining}d`}
    </span>
  );
}
