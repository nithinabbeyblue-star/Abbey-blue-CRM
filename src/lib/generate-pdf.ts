import jsPDF from "jspdf";
import "jspdf-autotable";
import { formatDateLong } from "@/lib/date-utils";
import { formatCurrency } from "@/constants/finance";

// Extend jsPDF with autotable
declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: Record<string, unknown>) => jsPDF;
  }
}

interface PaymentData {
  id: string;
  amount: number;
  currency: string;
  type: string;
  status: string;
  notes: string | null;
  paidAt: string | null;
  createdAt: string;
  stripePaymentIntent: string | null;
  ticket: {
    refNumber: string;
    clientName: string;
    clientEmail: string | null;
    clientPhone: string | null;
    caseType: string;
    ablFee: number | null;
    govFee: number | null;
    adsFee: number | null;
    adverts: number | null;
    paidAmount: number;
  };
  recordedBy: { name: string };
}

const COMPANY_NAME = "Abbey Legal";
const COMPANY_ADDRESS = "Dublin, Ireland";
const COMPANY_EMAIL = "info@abbeylegal.ie";
const COMPANY_PHONE = "+353 1 234 5678";

const NAVY = [15, 23, 42] as const;       // slate-900
const SLATE = [71, 85, 105] as const;     // slate-500
const LIGHT_BG = [248, 250, 252] as const; // slate-50

function formatPaymentType(type: string): string {
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Invoice PDF ──────────────────────────────────────────────────────────────

export function generateInvoice(data: PaymentData): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  // Header band
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageWidth, 40, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text(COMPANY_NAME, 14, 18);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(COMPANY_ADDRESS, 14, 26);
  doc.text(`${COMPANY_EMAIL}  |  ${COMPANY_PHONE}`, 14, 32);

  // INVOICE label
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.text("INVOICE", pageWidth - 14, 24, { align: "right" });

  y = 52;

  // Invoice details
  doc.setTextColor(...NAVY);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Invoice To:", 14, y);
  doc.text("Invoice Details:", pageWidth / 2 + 10, y);

  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...SLATE);

  // Client info (left)
  doc.text(data.ticket.clientName, 14, y);
  y += 5;
  if (data.ticket.clientEmail) {
    doc.text(data.ticket.clientEmail, 14, y);
    y += 5;
  }
  if (data.ticket.clientPhone) {
    doc.text(data.ticket.clientPhone, 14, y);
  }

  // Invoice meta (right)
  let ry = 59;
  const rx = pageWidth / 2 + 10;
  doc.text(`Ref: ${data.ticket.refNumber}`, rx, ry);
  ry += 5;
  doc.text(`Date: ${formatDateLong(data.createdAt)}`, rx, ry);
  ry += 5;
  doc.text(`Case: ${data.ticket.caseType.replace(/_/g, " ")}`, rx, ry);
  ry += 5;
  doc.text(`Status: ${data.status}`, rx, ry);

  y = Math.max(y, ry) + 15;

  // Line separator
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(14, y, pageWidth - 14, y);
  y += 10;

  // Services table
  doc.autoTable({
    startY: y,
    head: [["Description", "Amount"]],
    body: [
      [
        `${formatPaymentType(data.type)}\n${data.ticket.refNumber} — ${data.ticket.clientName}`,
        formatCurrency(data.amount, data.currency),
      ],
    ],
    headStyles: {
      fillColor: NAVY,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 10,
    },
    bodyStyles: {
      fontSize: 10,
      textColor: SLATE,
    },
    alternateRowStyles: {
      fillColor: LIGHT_BG,
    },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 50, halign: "right" },
    },
    margin: { left: 14, right: 14 },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 10;

  // Total box
  const totalBoxWidth = 80;
  const totalBoxX = pageWidth - 14 - totalBoxWidth;
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(totalBoxX, y, totalBoxWidth, 25, 3, 3, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...NAVY);
  doc.text("Total Due:", totalBoxX + 6, y + 10);
  doc.setFontSize(14);
  doc.text(formatCurrency(data.amount, data.currency), totalBoxX + totalBoxWidth - 6, y + 10, {
    align: "right",
  });

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...SLATE);
  doc.text("(VAT inclusive at 23%)", totalBoxX + 6, y + 19);

  y += 40;

  // Payment instructions
  doc.setFillColor(239, 246, 255); // blue-50
  doc.roundedRect(14, y, pageWidth - 28, 20, 3, 3, "F");
  doc.setFontSize(9);
  doc.setTextColor(30, 64, 175); // blue-800
  doc.setFont("helvetica", "bold");
  doc.text("Payment Instructions", 20, y + 7);
  doc.setFont("helvetica", "normal");
  doc.text(
    "Please make payment via the Stripe link provided or contact us for bank transfer details.",
    20,
    y + 14
  );

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 15;
  doc.setDrawColor(226, 232, 240);
  doc.line(14, footerY - 5, pageWidth - 14, footerY - 5);
  doc.setFontSize(8);
  doc.setTextColor(...SLATE);
  doc.text(
    `${COMPANY_NAME}  |  Generated on ${new Date().toLocaleDateString("en-IE")}`,
    pageWidth / 2,
    footerY,
    { align: "center" }
  );

  doc.save(`Invoice-${data.ticket.refNumber}-${data.id.slice(-6)}.pdf`);
}

// ── Receipt PDF ──────────────────────────────────────────────────────────────

export function generateReceipt(data: PaymentData): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  // Header band
  doc.setFillColor(22, 101, 52); // green-800
  doc.rect(0, 0, pageWidth, 40, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text(COMPANY_NAME, 14, 18);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(COMPANY_ADDRESS, 14, 26);
  doc.text(`${COMPANY_EMAIL}  |  ${COMPANY_PHONE}`, 14, 32);

  // RECEIPT label
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.text("RECEIPT", pageWidth - 14, 24, { align: "right" });

  y = 52;

  // Paid stamp
  doc.setFillColor(220, 252, 231); // green-100
  doc.roundedRect(pageWidth - 70, y - 5, 56, 18, 3, 3, "F");
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(22, 101, 52);
  doc.text("PAID", pageWidth - 42, y + 7, { align: "center" });

  // Receipt details
  doc.setTextColor(...NAVY);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Received From:", 14, y);

  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...SLATE);
  doc.text(data.ticket.clientName, 14, y);
  y += 5;
  if (data.ticket.clientEmail) {
    doc.text(data.ticket.clientEmail, 14, y);
    y += 5;
  }
  doc.text(`Ref: ${data.ticket.refNumber}`, 14, y);
  y += 5;
  doc.text(`Case: ${data.ticket.caseType.replace(/_/g, " ")}`, 14, y);

  y += 15;

  // Payment details table
  doc.autoTable({
    startY: y,
    head: [["Detail", "Value"]],
    body: [
      ["Payment Type", formatPaymentType(data.type)],
      ["Amount", formatCurrency(data.amount, data.currency)],
      ["Currency", data.currency],
      ["Date Paid", data.paidAt ? formatDateLong(data.paidAt) : "—"],
      ["Recorded By", data.recordedBy.name],
      ...(data.stripePaymentIntent
        ? [["Stripe Reference", data.stripePaymentIntent]]
        : []),
      ["Payment ID", data.id],
    ],
    headStyles: {
      fillColor: [22, 101, 52],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 10,
    },
    bodyStyles: {
      fontSize: 10,
      textColor: SLATE,
    },
    alternateRowStyles: {
      fillColor: [240, 253, 244], // green-50
    },
    columnStyles: {
      0: { cellWidth: 60, fontStyle: "bold", textColor: NAVY },
      1: { cellWidth: "auto" },
    },
    margin: { left: 14, right: 14 },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 15;

  // Amount paid box
  doc.setFillColor(220, 252, 231);
  doc.roundedRect(14, y, pageWidth - 28, 30, 3, 3, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(22, 101, 52);
  doc.text("Amount Received", 24, y + 12);

  doc.setFontSize(18);
  doc.text(formatCurrency(data.amount, data.currency), pageWidth - 24, y + 12, {
    align: "right",
  });

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...SLATE);
  doc.text("Thank you for your payment.", 24, y + 22);

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 15;
  doc.setDrawColor(226, 232, 240);
  doc.line(14, footerY - 5, pageWidth - 14, footerY - 5);
  doc.setFontSize(8);
  doc.setTextColor(...SLATE);
  doc.text(
    `${COMPANY_NAME}  |  Receipt generated on ${new Date().toLocaleDateString("en-IE")}`,
    pageWidth / 2,
    footerY,
    { align: "center" }
  );

  doc.save(`Receipt-${data.ticket.refNumber}-${data.id.slice(-6)}.pdf`);
}
