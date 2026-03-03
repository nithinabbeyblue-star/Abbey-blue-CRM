import { db } from "./db";

/**
 * Generates a unique ticket reference number.
 * Format: ABY-YYYYMMDD-XXXX (e.g., ABY-20260227-0012)
 */
export async function generateRefNumber(): Promise<string> {
  const today = new Date();
  const dateStr =
    today.getFullYear().toString() +
    (today.getMonth() + 1).toString().padStart(2, "0") +
    today.getDate().toString().padStart(2, "0");

  const prefix = `ABY-${dateStr}-`;

  // Find the latest ticket with today's prefix
  const latest = await db.ticket.findFirst({
    where: { refNumber: { startsWith: prefix } },
    orderBy: { refNumber: "desc" },
    select: { refNumber: true },
  });

  let nextNum = 1;
  if (latest) {
    const lastNum = parseInt(latest.refNumber.split("-").pop() || "0", 10);
    nextNum = lastNum + 1;
  }

  return `${prefix}${nextNum.toString().padStart(4, "0")}`;
}
