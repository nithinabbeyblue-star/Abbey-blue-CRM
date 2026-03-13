/**
 * Smart Deadline Engine — calculates milestone alerts for immigration cases.
 * Milestones: 120, 90, 60, 30, 14, 7 days before expiry/deadline.
 */

export const MILESTONES = [120, 90, 60, 30, 14, 7] as const;
export type Milestone = (typeof MILESTONES)[number];

export interface DeadlineInfo {
  daysRemaining: number;
  milestone: Milestone | null;
  urgency: "safe" | "warning" | "urgent" | "critical" | "expired";
  label: string;
}

export function calculateDeadline(expiryDate: Date | string | null): DeadlineInfo | null {
  if (!expiryDate) return null;

  const expiry = new Date(expiryDate);
  if (isNaN(expiry.getTime())) return null;

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const exp = new Date(expiry);
  exp.setHours(0, 0, 0, 0);

  const diffMs = exp.getTime() - now.getTime();
  const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  // Find the closest milestone that's been hit (days remaining <= milestone)
  let milestone: Milestone | null = null;
  for (const m of MILESTONES) {
    if (daysRemaining <= m && daysRemaining > 0) {
      milestone = m;
      break;
    }
  }

  let urgency: DeadlineInfo["urgency"];
  let label: string;

  if (daysRemaining <= 0) {
    urgency = "expired";
    label = daysRemaining === 0 ? "Expires today" : `Expired ${Math.abs(daysRemaining)}d ago`;
  } else if (daysRemaining <= 14) {
    urgency = "critical";
    label = `${daysRemaining}d remaining`;
  } else if (daysRemaining <= 30) {
    urgency = "urgent";
    label = `${daysRemaining}d remaining`;
  } else if (daysRemaining <= 90) {
    urgency = "warning";
    label = `${daysRemaining}d remaining`;
  } else {
    urgency = "safe";
    label = `${daysRemaining}d remaining`;
  }

  return { daysRemaining, milestone, urgency, label };
}

export const URGENCY_STYLES = {
  safe: {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-700",
    dot: "bg-emerald-400",
    badge: "bg-emerald-100 text-emerald-700",
  },
  warning: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
    dot: "bg-amber-400",
    badge: "bg-amber-100 text-amber-700",
  },
  urgent: {
    bg: "bg-orange-50",
    border: "border-orange-200",
    text: "text-orange-700",
    dot: "bg-orange-500",
    badge: "bg-orange-100 text-orange-700",
  },
  critical: {
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-700",
    dot: "bg-red-500 animate-pulse",
    badge: "bg-red-100 text-red-700",
  },
  expired: {
    bg: "bg-red-100",
    border: "border-red-300",
    text: "text-red-800",
    dot: "bg-red-600",
    badge: "bg-red-200 text-red-800",
  },
};

/** Generate a professional email template for a deadline reminder */
export function generateReminderEmail(params: {
  clientName: string;
  clientEmail: string;
  caseType: string;
  refNumber: string;
  expiryDate: string;
  daysRemaining: number;
  milestone: number;
}): { subject: string; html: string } {
  const { clientName, caseType, refNumber, expiryDate, daysRemaining, milestone } = params;
  const formattedDate = new Date(expiryDate).toLocaleDateString("en-IE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const caseLabel = caseType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const subject = `${milestone}-Day Reminder: Your ${caseLabel} — Action Required (${refNumber})`;

  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; padding: 24px;">
      <div style="background: #1e3a5f; color: white; padding: 24px 32px; border-radius: 12px 12px 0 0;">
        <h1 style="margin: 0; font-size: 22px; font-weight: 600;">Abbey Legal</h1>
        <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.8;">Immigration Consultancy — Dublin, Ireland</p>
      </div>

      <div style="background: white; padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="font-size: 15px; color: #334155; margin: 0 0 16px;">Dear <strong>${clientName}</strong>,</p>

        <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 16px;">
          This is a courtesy reminder that your <strong>${caseLabel}</strong> is due to expire on
          <strong style="color: ${daysRemaining <= 30 ? "#dc2626" : "#d97706"};">${formattedDate}</strong>
          — that's <strong>${daysRemaining} days</strong> from today.
        </p>

        <div style="background: ${daysRemaining <= 30 ? "#fef2f2" : "#fffbeb"}; border: 1px solid ${daysRemaining <= 30 ? "#fecaca" : "#fde68a"}; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0; font-size: 13px; font-weight: 600; color: ${daysRemaining <= 30 ? "#991b1b" : "#92400e"};">
            Case Reference: ${refNumber}
          </p>
          <p style="margin: 4px 0 0; font-size: 13px; color: ${daysRemaining <= 30 ? "#b91c1c" : "#a16207"};">
            Type: ${caseLabel} &bull; Expiry: ${formattedDate} &bull; ${daysRemaining} days remaining
          </p>
        </div>

        <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 16px 0;">
          <strong>Next Steps:</strong>
        </p>
        <ol style="font-size: 14px; color: #475569; line-height: 1.8; padding-left: 20px; margin: 0 0 16px;">
          <li>Gather all required documents for your ${caseLabel} renewal/application</li>
          <li>Review any changes to your personal circumstances since your last application</li>
          <li>Contact us to schedule a consultation to review your case</li>
          <li>Submit your application well in advance of the expiry date</li>
        </ol>

        <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 24px;">
          Please don't hesitate to reach out if you have any questions or need assistance with your application.
        </p>

        <div style="text-align: center; margin: 24px 0;">
          <a href="mailto:info@abbeylegal.ie" style="display: inline-block; background: #1e3a5f; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600;">
            Contact Us
          </a>
        </div>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />

        <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">
          Abbey Legal Immigration Consultancy<br />
          Dublin, Ireland &bull; info@abbeylegal.ie
        </p>
      </div>
    </div>
  `;

  return { subject, html };
}
