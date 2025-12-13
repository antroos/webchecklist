import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import { auth } from "@/auth";
import { getAdminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

export async function POST() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getAdminDb();
  await db
    .collection("users")
    .doc(userId)
    .set(
      {
        overageUnlockedUntilPeriodEnd: true,
        overageUnlockConfirmedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

  return NextResponse.json({ ok: true });
}


