"use client";

import Link from "next/link";
import { CaseBadge } from "@/components/ui/case-badge";
import { StatusBadge } from "@/components/ui/status-badge";

interface CaseHeaderProps {
  refNumber: string;
  clientName: string;
  caseType: string | null;
  status: string;
  caseOwner: { name: string } | null;
  caseWorker: { name: string } | null;
  caseDeadline: string | null;
  backHref: string;
}

function getDeadlineInfo(deadline: string | null): { label: string; daysText: string; isUrgent: boolean } | null {
  if (!deadline) return null;
  const now = new Date();
  const dl = new Date(deadline);
  const diffMs = dl.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const formatted = dl.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  if (diffDays < 0) {
    return { label: formatted, daysText: `${Math.abs(diffDays)}d overdue`, isUrgent: true };
  }
  if (diffDays <= 3) {
    return { label: formatted, daysText: `${diffDays}d left`, isUrgent: true };
  }
  return { label: formatted, daysText: `${diffDays}d left`, isUrgent: false };
}

export function CaseHeader({
  refNumber,
  clientName,
  caseType,
  status,
  caseOwner,
  caseWorker,
  caseDeadline,
  backHref,
}: CaseHeaderProps) {
  const deadline = getDeadlineInfo(caseDeadline);

  return (
    <div className="sticky top-0 z-10 -mx-4 mb-6 border-b border-border bg-white/95 px-4 pb-4 pt-2 backdrop-blur-sm sm:-mx-6 sm:px-6">
      <Link
        href={backHref}
        className="text-sm text-muted hover:text-primary"
      >
        &larr; Back
      </Link>

      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        {/* Left: Client + Case info */}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold text-foreground">{clientName}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-primary">{refNumber}</span>
            <CaseBadge caseType={caseType} />
            <StatusBadge status={status} size="sm" />
          </div>
        </div>

        {/* Right: Ownership + Deadline */}
        <div className="flex flex-col items-start gap-1 text-sm sm:items-end sm:text-right">
          <div className="text-muted">
            Owner:{" "}
            <span className="font-medium text-foreground">
              {caseOwner?.name ?? "—"}
            </span>
          </div>
          <div className="text-muted">
            Worker:{" "}
            <span className="font-medium text-foreground">
              {caseWorker?.name ?? "Unassigned"}
            </span>
          </div>
          {deadline && (
            <div
              className={`mt-0.5 rounded-md px-2 py-0.5 text-xs font-semibold ${
                deadline.isUrgent
                  ? "bg-red-100 text-red-700"
                  : "bg-gray-100 text-muted"
              }`}
            >
              Deadline: {deadline.label} ({deadline.daysText})
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
