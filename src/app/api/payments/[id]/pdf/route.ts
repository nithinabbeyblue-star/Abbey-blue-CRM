import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { Role } from "@/generated/prisma/enums";

// GET /api/payments/[id]/pdf — Fetch full payment data for PDF generation
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireRole(
    Role.SALES,
    Role.ADMIN,
    Role.SALES_MANAGER,
    Role.ADMIN_MANAGER,
    Role.SUPER_ADMIN
  );
  if (error) return error;

  const { id } = await params;

  const payment = await db.payment.findUnique({
    where: { id },
    include: {
      ticket: {
        select: {
          refNumber: true,
          clientName: true,
          clientEmail: true,
          clientPhone: true,
          caseType: true,
          ablFee: true,
          govFee: true,
          adsFee: true,
          adverts: true,
          paidAmount: true,
        },
      },
      recordedBy: { select: { name: true } },
    },
  });

  if (!payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  return NextResponse.json({ payment });
}
