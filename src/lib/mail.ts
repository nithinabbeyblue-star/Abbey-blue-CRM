import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendMail({ to, subject, html }: SendMailOptions) {
  if (!resend) {
    console.log(`[Mail Stub] To: ${to} | Subject: ${subject}`);
    return;
  }

  await resend.emails.send({
    from: "Abbey CRM <noreply@abbeylegal.com>",
    to,
    subject,
    html,
  });
}

export async function notifyKeyCoordinator(ticket: {
  refNumber: string;
  clientName: string;
  clientPhone: string;
  caseType?: string | null;
  destination?: string | null;
  source: string;
  createdByName: string;
}) {
  const coordinatorEmail = process.env.KEY_COORDINATOR_EMAIL;
  if (!coordinatorEmail) {
    console.log("[Mail] KEY_COORDINATOR_EMAIL not set, skipping notification");
    return;
  }

  await sendMail({
    to: coordinatorEmail,
    subject: `New Lead: ${ticket.refNumber} — ${ticket.clientName}`,
    html: `
      <h2>New Ticket Created</h2>
      <table style="border-collapse:collapse;">
        <tr><td style="padding:4px 12px;font-weight:bold;">Ref</td><td>${ticket.refNumber}</td></tr>
        <tr><td style="padding:4px 12px;font-weight:bold;">Client</td><td>${ticket.clientName}</td></tr>
        <tr><td style="padding:4px 12px;font-weight:bold;">Phone</td><td>${ticket.clientPhone}</td></tr>
        <tr><td style="padding:4px 12px;font-weight:bold;">Case Type</td><td>${ticket.caseType || "N/A"}</td></tr>
        <tr><td style="padding:4px 12px;font-weight:bold;">Destination</td><td>${ticket.destination || "N/A"}</td></tr>
        <tr><td style="padding:4px 12px;font-weight:bold;">Source</td><td>${ticket.source}</td></tr>
        <tr><td style="padding:4px 12px;font-weight:bold;">Created By</td><td>${ticket.createdByName}</td></tr>
      </table>
      <p style="margin-top:16px;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/admin">Open Dashboard</a>
      </p>
    `,
  });
}
