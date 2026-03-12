import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getStripe } from "@/lib/stripe";
import { requireRole } from "@/lib/rbac";
import { Role } from "@/generated/prisma/enums";

const paymentLinkSchema = z.object({
  amount: z.number().positive("Amount must be positive"),
  currency: z.string().default("EUR"),
  description: z.string().optional(),
  clientName: z.string().optional(),
  refNumber: z.string().optional(),
});

// POST /api/stripe/payment-link — Generate a reusable Stripe Payment Link
export async function POST(request: NextRequest) {
  const { error } = await requireRole(
    Role.SALES,
    Role.ADMIN,
    Role.SALES_MANAGER,
    Role.ADMIN_MANAGER,
    Role.SUPER_ADMIN
  );
  if (error) return error;

  try {
    const body = await request.json();
    const data = paymentLinkSchema.parse(body);

    const stripe = getStripe();

    // Create a Stripe Product + Price on the fly
    const product = await stripe.products.create({
      name: data.description || `Payment${data.refNumber ? ` for ${data.refNumber}` : ""}`,
      metadata: {
        ...(data.refNumber ? { refNumber: data.refNumber } : {}),
        ...(data.clientName ? { clientName: data.clientName } : {}),
      },
    });

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: Math.round(data.amount * 100),
      currency: data.currency.toLowerCase(),
    });

    // Create the Payment Link
    const paymentLink = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      metadata: {
        ...(data.refNumber ? { refNumber: data.refNumber } : {}),
        ...(data.clientName ? { clientName: data.clientName } : {}),
      },
    });

    return NextResponse.json({
      paymentLinkId: paymentLink.id,
      paymentLinkUrl: paymentLink.url,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: err.issues },
        { status: 400 }
      );
    }
    console.error("Stripe payment link error:", err);
    return NextResponse.json(
      { error: "Failed to create payment link" },
      { status: 500 }
    );
  }
}
