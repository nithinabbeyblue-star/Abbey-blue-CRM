import { CASE_CONFIG, type CaseTypeKey } from "@/constants/cases";

export function CaseBadge({
  caseType,
  size = "xs",
}: {
  caseType: string | null | undefined;
  size?: "xs" | "sm";
}) {
  if (!caseType) return null;

  const config = CASE_CONFIG[caseType as CaseTypeKey];
  if (!config) {
    return (
      <span className="inline-block rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
        {caseType.replace(/_/g, " ")}
      </span>
    );
  }

  const sizeClasses = size === "xs" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs";

  return (
    <span className={`inline-block rounded-full font-medium ${config.badgeBg} ${config.badgeText} ${sizeClasses}`}>
      {config.label}
    </span>
  );
}
