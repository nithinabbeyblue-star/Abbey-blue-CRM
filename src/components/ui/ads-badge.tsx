"use client";

interface AdsBadgeProps {
  adsFinishingDate: string | null;
}

export function AdsBadge({ adsFinishingDate }: AdsBadgeProps) {
  if (!adsFinishingDate) return null;

  const now = new Date();
  const finishDate = new Date(adsFinishingDate);
  const diffMs = finishDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) {
    return (
      <div className="flex items-center gap-1.5 rounded-md bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        ADS Period Complete
      </div>
    );
  }

  const isUrgent = diffDays <= 7;
  return (
    <div
      className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
        isUrgent ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"
      }`}
    >
      ADS: {diffDays} {diffDays === 1 ? "Day" : "Days"} Remaining
    </div>
  );
}
