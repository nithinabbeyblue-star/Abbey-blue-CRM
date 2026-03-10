import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { Role } from "@/generated/prisma/enums";
import { calcTotal, calcDue } from "@/constants/finance";

// GET /api/payment-followup — Fetch all tickets with financial data for follow-up
export async function GET(request: NextRequest) {
  const { user, error } = await requireRole(
    Role.SALES,
    Role.SALES_MANAGER,
    Role.SUPER_ADMIN
  );
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get("status");
  const search = searchParams.get("search");
  const outstandingOnly = searchParams.get("outstandingOnly") === "true";
  const sortBy = searchParams.get("sortBy") || "amountDue";
  const sortDir = searchParams.get("sortDir") || "desc";

  // Role-based scoping
  const where: Record<string, unknown> = {};

  if (user.role === Role.SALES) {
    // Regular Sales: only their own created tickets
    where.createdById = user.userId;
  } else if (user.role === Role.SALES_MANAGER) {
    // Sales Manager: all tickets created by sales team
    const salesUsers = await db.user.findMany({
      where: { role: { in: [Role.SALES, Role.SALES_MANAGER] }, status: "ACTIVE" },
      select: { id: true },
    });
    where.createdById = { in: salesUsers.map((u) => u.id) };
  }
  // SUPER_ADMIN sees everything

  // Status filter
  if (statusFilter && statusFilter !== "ALL") {
    where.status = statusFilter;
  }

  // Search by client name or phone
  if (search && search.trim().length >= 2) {
    const term = search.trim();
    where.OR = [
      { clientName: { contains: term, mode: "insensitive" } },
      { clientPhone: { contains: term } },
      { refNumber: { contains: term, mode: "insensitive" } },
    ];
  }

  // Fetch tickets with payment aggregation
  const tickets = await db.ticket.findMany({
    where,
    select: {
      id: true,
      refNumber: true,
      clientName: true,
      clientPhone: true,
      caseType: true,
      status: true,
      ablFee: true,
      govFee: true,
      adsFee: true,
      adverts: true,
      paidAmount: true,
      updatedAt: true,
      createdBy: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
      payments: {
        where: { status: "PAID" },
        select: { amount: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  // Calculate financials using shared functions from constants/finance.ts
  // ABL fee is VAT-inclusive, so Total = ablFee + govFee + adsFee + adverts (no extra VAT)
  const results = tickets.map((t) => {
    const totalAmount = calcTotal(t.ablFee, t.govFee, t.adverts, t.adsFee);
    const amountPaid = Math.round(t.payments.reduce((sum, p) => sum + p.amount, 0) * 100) / 100;
    const amountDue = Math.max(0, calcDue(totalAmount, amountPaid));

    return {
      id: t.id,
      refNumber: t.refNumber,
      clientName: t.clientName,
      clientPhone: t.clientPhone,
      caseType: t.caseType,
      status: t.status,
      totalAmount: Math.round(totalAmount * 100) / 100,
      amountPaid: Math.round(amountPaid * 100) / 100,
      amountDue: Math.round(amountDue * 100) / 100,
      updatedAt: t.updatedAt.toISOString(),
      createdBy: t.createdBy,
      assignedTo: t.assignedTo,
    };
  });

  // Filter outstanding only (after calculation)
  const filtered = outstandingOnly
    ? results.filter((r) => r.amountDue > 0)
    : results;

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortBy === "amountDue") {
      cmp = a.amountDue - b.amountDue;
    } else if (sortBy === "totalAmount") {
      cmp = a.totalAmount - b.totalAmount;
    } else if (sortBy === "amountPaid") {
      cmp = a.amountPaid - b.amountPaid;
    } else if (sortBy === "updatedAt") {
      cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
    } else if (sortBy === "clientName") {
      cmp = a.clientName.localeCompare(b.clientName);
    } else if (sortBy === "status") {
      cmp = a.status.localeCompare(b.status);
    }
    return sortDir === "desc" ? -cmp : cmp;
  });

  // Summary stats
  const totalOutstanding = results.reduce((sum, r) => sum + r.amountDue, 0);
  const totalCollected = results.reduce((sum, r) => sum + r.amountPaid, 0);
  const urgentCount = results.filter(
    (r) => r.status === "APPROVED" && r.amountDue > 0
  ).length;

  return NextResponse.json({
    cases: sorted,
    summary: {
      totalCases: sorted.length,
      totalOutstanding: Math.round(totalOutstanding * 100) / 100,
      totalCollected: Math.round(totalCollected * 100) / 100,
      urgentFollowups: urgentCount,
    },
  });
}

// POST /api/payment-followup — Log a follow-up call note
export async function POST(request: NextRequest) {
  const { user, error } = await requireRole(
    Role.SALES,
    Role.SALES_MANAGER,
    Role.SUPER_ADMIN
  );
  if (error) return error;

  try {
    const { ticketId, note } = await request.json();

    if (!ticketId || !note?.trim()) {
      return NextResponse.json(
        { error: "Ticket ID and note are required" },
        { status: 400 }
      );
    }

    // Verify ticket exists
    const ticket = await db.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    // Create audit log entry for the follow-up call
    const log = await db.auditLog.create({
      data: {
        ticketId,
        userId: user.userId,
        action: "FOLLOW_UP_CALL",
        newValue: note.trim(),
        metadata: JSON.stringify({
          clientName: ticket.clientName,
          clientPhone: ticket.clientPhone,
        }),
      },
    });

    return NextResponse.json({ log }, { status: 201 });
  } catch (err) {
    console.error("Follow-up call log error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
