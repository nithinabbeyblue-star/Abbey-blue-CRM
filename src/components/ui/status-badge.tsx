export const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  LEAD:           { bg: "bg-blue-100",   text: "text-blue-700",   label: "New Client" },
  DOC_COLLECTION: { bg: "bg-yellow-100", text: "text-yellow-700", label: "Doc Collection" },
  SUBMITTED:      { bg: "bg-purple-100", text: "text-purple-700", label: "Submitted" },
  IN_PROGRESS:    { bg: "bg-orange-100", text: "text-orange-700", label: "In Progress" },
  APPROVED:       { bg: "bg-green-100",  text: "text-green-700",  label: "Approved" },
  REJECTED:       { bg: "bg-red-100",    text: "text-red-700",    label: "Rejected" },
  ON_HOLD:        { bg: "bg-gray-100",   text: "text-gray-700",   label: "On Hold" },
};

export const ORDERED_STATUSES = [
  "LEAD",
  "DOC_COLLECTION",
  "SUBMITTED",
  "IN_PROGRESS",
  "APPROVED",
  "REJECTED",
  "ON_HOLD",
] as const;

export function getStatusLabel(status: string): string {
  return STATUS_CONFIG[status]?.label ?? status.replace(/_/g, " ");
}

export function StatusBadge({
  status,
  size = "sm",
}: {
  status: string;
  size?: "xs" | "sm";
}) {
  const config = STATUS_CONFIG[status];
  if (!config) {
    return (
      <span className="inline-block rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
        {status.replace(/_/g, " ")}
      </span>
    );
  }

  const sizeClasses = size === "xs" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs";

  return (
    <span className={`inline-block rounded-full font-medium ${config.bg} ${config.text} ${sizeClasses}`}>
      {config.label}
    </span>
  );
}
