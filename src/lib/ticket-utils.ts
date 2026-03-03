import { CASE_CONFIG, type CaseTypeKey } from "@/constants/cases";
import { db } from "./db";

/**
 * Generates a unique ticket reference number.
 * Format: ABBEY-{CODE}-{YEAR}-{SEQ} (e.g., ABBEY-CSEP-2026-001)
 */
export async function generateRefNumber(caseType?: CaseTypeKey | null): Promise<string> {
  const year = new Date().getFullYear().toString();
  const code = caseType ? CASE_CONFIG[caseType].shortCode : "MISC";
  const prefix = `ABBEY-${code}-${year}-`;

  const latest = await db.ticket.findFirst({
    where: { refNumber: { startsWith: prefix } },
    orderBy: { refNumber: "desc" },
    select: { refNumber: true },
  });

  let nextSeq = 1;
  if (latest) {
    const parts = latest.refNumber.split("-");
    const lastNum = parseInt(parts[parts.length - 1] || "0", 10);
    nextSeq = lastNum + 1;
  }

  return `${prefix}${nextSeq.toString().padStart(3, "0")}`;
}
