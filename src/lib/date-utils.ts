/**
 * Shared date formatting utilities for the CRM.
 * Replaces 6 duplicate formatDate implementations across the codebase.
 */

/** DD Mon YYYY — e.g. "13 Mar 2026". Returns "—" for null/undefined. */
export function formatDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** DD Month YYYY — e.g. "13 March 2026" (long month, for PDFs/formal docs). */
export function formatDateLong(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-IE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/** DD Mon (no year) — e.g. "13 Mar" (compact, for chat messages). */
export function formatDateCompact(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
}

/** YYYY-MM-DD — e.g. "2026-03-13" (for date inputs and APIs). */
export function formatDateISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
