import { FieldValue } from "firebase-admin/firestore";

import { getAdminDb } from "./firebaseAdmin";

export type UserPlan = "starter" | "pro" | null;

export type UserDoc = {
  email?: string | null;
  name?: string | null;
  createdAt: FirebaseFirestore.FieldValue;
  updatedAt: FirebaseFirestore.FieldValue;
  freeCreditsRemaining: number;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripeSubscriptionStatus?: string | null;
  stripeMeteredItemId?: string | null;

  // Billing (app-side included quota + overage cap)
  plan?: UserPlan;
  includedMonthlyLimit?: number; // 50/200 depending on plan
  periodStart?: FirebaseFirestore.Timestamp | null;
  periodEnd?: FirebaseFirestore.Timestamp | null;
  periodIncludedUsed?: number;
  periodOverageUsed?: number;
  periodOverageReserved?: number;
  overageLimitCents?: number; // default 1000 ($10)
  overageUnlockedUntilPeriodEnd?: boolean;
  overageUnlockConfirmedAt?: FirebaseFirestore.FieldValue | FirebaseFirestore.Timestamp | null;
};

export async function ensureUserExists(params: {
  userId: string;
  email?: string | null;
  name?: string | null;
}) {
  const db = getAdminDb();
  const ref = db.collection("users").doc(params.userId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      tx.set(ref, {
        email: params.email ?? null,
        name: params.name ?? null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        freeCreditsRemaining: 5,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        stripeSubscriptionStatus: null,
        stripeMeteredItemId: null,

        plan: null,
        includedMonthlyLimit: 0,
        periodStart: null,
        periodEnd: null,
        periodIncludedUsed: 0,
        periodOverageUsed: 0,
        periodOverageReserved: 0,
        overageLimitCents: 1000,
        overageUnlockedUntilPeriodEnd: false,
        overageUnlockConfirmedAt: null,
      } satisfies UserDoc);
      return;
    }

    tx.update(ref, {
      email: params.email ?? snap.get("email") ?? null,
      name: params.name ?? snap.get("name") ?? null,
      // backfill new fields if missing (keeps old users compatible)
      plan: (snap.get("plan") ?? null) as UserPlan,
      includedMonthlyLimit: snap.get("includedMonthlyLimit") ?? 0,
      periodIncludedUsed: snap.get("periodIncludedUsed") ?? 0,
      periodOverageUsed: snap.get("periodOverageUsed") ?? 0,
      periodOverageReserved: snap.get("periodOverageReserved") ?? 0,
      overageLimitCents: snap.get("overageLimitCents") ?? 1000,
      overageUnlockedUntilPeriodEnd: snap.get("overageUnlockedUntilPeriodEnd") ?? false,
      updatedAt: FieldValue.serverTimestamp(),
    } satisfies Partial<UserDoc>);
  });
}

export async function getUserCredits(userId: string): Promise<number> {
  const db = getAdminDb();
  const snap = await db.collection("users").doc(userId).get();
  const v = snap.get("freeCreditsRemaining");
  return typeof v === "number" ? v : 0;
}


