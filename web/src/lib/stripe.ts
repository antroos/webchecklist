import Stripe from "stripe";

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  // Keep Stripe API version default unless you pin it explicitly in your Stripe dashboard.
  return new Stripe(key);
}


