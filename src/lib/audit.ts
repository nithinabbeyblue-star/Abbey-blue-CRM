import { db } from "@/lib/db";

interface AuditLogParams {
  action: string;
  userId: string;
  ticketId?: string;
  oldValue?: string | null;
  newValue?: string | null;
  metadata?: string;
  ipAddress?: string;
  userAgent?: string;
}

/** Create a global audit log entry. Works for both ticket-scoped and system-wide events. */
export async function createAuditLog(params: AuditLogParams): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        action: params.action,
        userId: params.userId,
        ticketId: params.ticketId || null,
        oldValue: params.oldValue || null,
        newValue: params.newValue || null,
        metadata: params.metadata || null,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
      },
    });
  } catch (err) {
    console.error("Audit log error:", err);
    // Non-blocking — audit failure should never break the main operation
  }
}

/** Extract IP address from request headers. */
export function extractIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    headers.get("x-real-ip") ||
    "unknown"
  );
}

/** Extract a short device fingerprint from user-agent. */
export function extractDevice(headers: Headers): string {
  const ua = headers.get("user-agent") || "unknown";
  // Shorten to browser + OS for readability
  if (ua.includes("Chrome")) {
    const os = ua.includes("Windows") ? "Windows" : ua.includes("Mac") ? "Mac" : ua.includes("Linux") ? "Linux" : "Other";
    return `Chrome on ${os}`;
  }
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Safari") && !ua.includes("Chrome")) return "Safari";
  if (ua.includes("Edge")) return "Edge";
  return ua.slice(0, 80);
}
