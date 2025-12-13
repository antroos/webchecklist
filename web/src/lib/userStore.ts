import { FieldValue } from "firebase-admin/firestore";

import { getAdminDb } from "./firebaseAdmin";

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
      } satisfies UserDoc);
      return;
    }

    tx.update(ref, {
      email: params.email ?? snap.get("email") ?? null,
      name: params.name ?? snap.get("name") ?? null,
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


