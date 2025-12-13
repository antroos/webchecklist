import { NextRequest, NextResponse } from "next/server";

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import Stripe from "stripe";

import { getAdminDb } from "@/lib/firebaseAdmin";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getWebhookSecret() {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  return secret;
}

async function upsertSubscriptionForUser(params: {
  userId: string;
  customerId: string | null;
  subscription: Stripe.Subscription | null;
}) {
  const db = getAdminDb();
  const ref = db.collection("users").doc(params.userId);

  const sub = params.subscription;
  const items = sub?.items?.data ?? [];
  const meteredItem = items.find((i) => i.price?.recurring?.usage_type === "metered");
  const fixedItem = items.find((i) => i.price?.recurring?.usage_type !== "metered");

  const starterPrice = process.env.STRIPE_PRICE_STARTER;
  const proPrice = process.env.STRIPE_PRICE_PRO;

  const fixedPriceId = fixedItem?.price?.id ?? null;
  const plan =
    fixedPriceId && starterPrice && fixedPriceId === starterPrice
      ? "starter"
      : fixedPriceId && proPrice && fixedPriceId === proPrice
        ? "pro"
        : null;
  const includedMonthlyLimit = plan === "starter" ? 50 : plan === "pro" ? 200 : 0;

  // Stripe types in this repo's pinned SDK omit some billing period fields; read them defensively.
  const subAny = sub as any;
  const periodStart =
    typeof subAny?.current_period_start === "number"
      ? Timestamp.fromMillis(subAny.current_period_start * 1000)
      : null;
  const periodEnd =
    typeof subAny?.current_period_end === "number"
      ? Timestamp.fromMillis(subAny.current_period_end * 1000)
      : null;

  // If billing period changed, reset counters and overage unlock.
  const existing = await ref.get().catch(() => null);
  const existingPeriodEnd = existing?.exists ? (existing.get("periodEnd") as Timestamp | null) : null;
  const subscriptionRemoved = !sub;
  const periodChanged =
    Boolean(
      periodEnd && (!existingPeriodEnd || existingPeriodEnd.toMillis() !== periodEnd.toMillis()),
    );

  await ref.set(
    {
      stripeCustomerId: params.customerId,
      stripeSubscriptionId: sub?.id ?? null,
      stripeSubscriptionStatus: sub?.status ?? null,
      stripeMeteredItemId: meteredItem?.id ?? null,
      plan,
      includedMonthlyLimit,
      periodStart,
      periodEnd,
      ...(subscriptionRemoved || periodChanged
        ? {
            periodIncludedUsed: 0,
            periodOverageUsed: 0,
            periodOverageReserved: 0,
            overageUnlockedUntilPeriodEnd: false,
            overageUnlockConfirmedAt: null,
          }
        : {}),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

export async function POST(req: NextRequest) {
  const stripe = getStripe();

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  const payload = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, getWebhookSecret());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId || session.client_reference_id || undefined;
        const subscriptionId =
          typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
        const customerId =
          typeof session.customer === "string" ? session.customer : session.customer?.id;

        if (userId && subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId, {
            expand: ["items.data.price"],
          });
          await upsertSubscriptionForUser({
            userId,
            customerId: customerId ?? null,
            subscription: sub,
          });
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.userId;
        const customerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer?.id;

        if (userId) {
          await upsertSubscriptionForUser({
            userId,
            customerId: customerId ?? null,
            subscription: event.type === "customer.subscription.deleted" ? null : sub,
          });
        }
        break;
      }
      default:
        break;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Webhook handler error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}


