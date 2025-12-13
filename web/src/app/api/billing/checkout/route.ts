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

  const planParam =
    req.nextUrl.searchParams.get("plan") ||
    ((await req.json().catch(() => ({}))) as { plan?: string }).plan ||
    "";
  const plan = planParam === "starter" || planParam === "pro" ? planParam : null;
  if (!plan) {
    return NextResponse.json(
      { error: "Missing or invalid plan (starter|pro)" },
      { status: 400 },
    );
  }

  const starterPrice = process.env.STRIPE_PRICE_STARTER;
  const proPrice = process.env.STRIPE_PRICE_PRO;
  const meteredPrice = process.env.STRIPE_PRICE_METERED;
  const basePrice = plan === "starter" ? starterPrice : proPrice;

  if (!basePrice || !meteredPrice) {
    return NextResponse.json(
      { error: "Stripe prices are not configured (STRIPE_PRICE_STARTER/PRO + STRIPE_PRICE_METERED)" },
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
      metadata: { userId, plan },
    },
    metadata: { userId, plan },
    line_items: [
      { price: basePrice, quantity: 1 },
      { price: meteredPrice, quantity: 1 },
    ],
  });

  return NextResponse.json({ url: checkout.url });
}


