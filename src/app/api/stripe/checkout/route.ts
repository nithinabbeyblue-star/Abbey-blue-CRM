import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { requireRole } from "@/lib/rbac";
import { Role, PaymentType, PaymentStatus } from "@/generated/prisma/enums";

const checkoutSchema = z.object({
  ticketId: z.string().min(1),
  amount: z.number().positive("Amount must be positive"),
  currency: z.string().default("EUR"),
  type: z.nativeEnum(PaymentType).default(PaymentType.OTHER),
  description: z.string().optional(),
});

// POST /api/stripe/checkout — Create a Stripe Checkout Session
export async function POST(request: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    return NextResponse.json(
      { error: "Online payments are not configured. Set STRIPE_SECRET_KEY in environment variables." },
      { status: 503 }
    );
  }

  const { user, error } = await requireRole(
    Role.SALES,
    Role.ADMIN,
    Role.SALES_MANAGER,
    Role.ADMIN_MANAGER,
    Role.SUPER_ADMIN
  );
  if (error) return error;

  try {
    const body = await request.json();
    const data = checkoutSchema.parse(body);

    // Verify ticket exists
    const ticket = await db.ticket.findUnique({
      where: { id: data.ticketId },
      select: { id: true, refNumber: true, clientName: true, clientEmail: true },
    });

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    // Create a pending payment record first
    const payment = await db.payment.create({
      data: {
        amount: data.amount,
        currency: data.currency,
        type: data.type,
        status: PaymentStatus.PENDING,
        notes: `Stripe checkout initiated by ${user.name || "staff"}`,
        ticketId: data.ticketId,
        recordedById: user.userId,
      },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // Create Stripe Checkout Session
    const session = await getStripe().checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: data.currency.toLowerCase(),
            product_data: {
              name: `Payment for ${ticket.refNumber}`,
              description:
                data.description ||
                `${data.type.replace(/_/g, " ")} — ${ticket.clientName}`,
            },
            unit_amount: Math.round(data.amount * 100), // Stripe uses cents
          },
          quantity: 1,
        },
      ],
      metadata: {
        paymentId: payment.id,
        ticketId: data.ticketId,
        refNumber: ticket.refNumber,
      },
      customer_email: ticket.clientEmail || undefined,
      success_url: `${appUrl}/super-admin/tickets/${data.ticketId}?payment=success`,
      cancel_url: `${appUrl}/super-admin/tickets/${data.ticketId}?payment=cancelled`,
    });

    // Link the Stripe session to our payment record
    await db.payment.update({
      where: { id: payment.id },
      data: { stripeSessionId: session.id },
    });

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
      paymentId: payment.id,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: err.issues },
        { status: 400 }
      );
    }
    console.error("Stripe checkout error:", err);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
