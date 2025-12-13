import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const email = session?.user?.email ?? undefined;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stripe = getStripe();

  const basePrice = process.env.STRIPE_PRICE_BASE;
  const meteredPrice = process.env.STRIPE_PRICE_METERED;
  if (!basePrice || !meteredPrice) {
    return NextResponse.json(
      { error: "Stripe prices are not configured (STRIPE_PRICE_BASE/STRIPE_PRICE_METERED)" },
      { status: 500 },
    );
  }

  const origin =
    req.headers.get("origin") ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3000";

  const checkout = await stripe.checkout.sessions.create({
    mode: "subscription",
    client_reference_id: userId,
    customer_email: email,
    success_url: `${origin}/app?checkout=success`,
    cancel_url: `${origin}/app?checkout=cancel`,
    subscription_data: {
      metadata: { userId },
    },
    metadata: { userId },
    line_items: [
      { price: basePrice, quantity: 1 },
      { price: meteredPrice, quantity: 1 },
    ],
  });

  return NextResponse.json({ url: checkout.url });
}


