import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { PaymentStatus } from "@/generated/prisma/enums";
import { invalidateCache } from "@/lib/redis";
import { triggerEvent } from "@/lib/pusher";
import Stripe from "stripe";

// Disable body parsing — Stripe needs the raw body for signature verification
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Stripe webhook signature verification failed:", message);
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${message}` },
      { status: 400 }
    );
  }

  // Handle checkout.session.completed
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    const paymentId = session.metadata?.paymentId;
    const ticketId = session.metadata?.ticketId;

    if (!paymentId) {
      console.error("Stripe webhook: missing paymentId in metadata");
      return NextResponse.json({ received: true });
    }

    try {
      // Update the payment record to PAID
      const payment = await db.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatus.PAID,
          paidAt: new Date(),
          stripePaymentIntent:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id || null,
          notes: `Paid via Stripe (Session: ${session.id})`,
        },
      });

      // Update the ticket's paidAmount by summing all PAID payments
      if (ticketId) {
        const paidTotal = await db.payment.aggregate({
          where: { ticketId, status: PaymentStatus.PAID },
          _sum: { amount: true },
        });

        await db.ticket.update({
          where: { id: ticketId },
          data: { paidAmount: paidTotal._sum.amount || 0 },
        });

        // Audit log
        await db.auditLog.create({
          data: {
            ticketId,
            userId: payment.recordedById,
            action: "PAYMENT_STRIPE_COMPLETED",
            newValue: `${payment.currency} ${payment.amount} paid via Stripe`,
            metadata: JSON.stringify({
              paymentId: payment.id,
              stripeSessionId: session.id,
              stripePaymentIntent: session.payment_intent,
            }),
          },
        });

        // Invalidate caches and notify dashboard
        await invalidateCache(
          "analytics:revenue:*",
          "analytics:revenue:trends",
          "analytics:overview"
        );
        triggerEvent("finance-dashboard", "finance-updated", { ticketId });
      }
    } catch (err) {
      console.error("Stripe webhook: failed to process payment:", err);
      return NextResponse.json(
        { error: "Failed to process payment" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ received: true });
}
