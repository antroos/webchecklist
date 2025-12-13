import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import { auth } from "@/auth";
import { getAdminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

function dollarsToCents(dollars: number) {
  return Math.round(dollars * 100);
}

export async function GET() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getAdminDb();
  const snap = await db.collection("users").doc(userId).get();
  if (!snap.exists) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const overageLimitCents = (snap.get("overageLimitCents") as number | undefined) ?? 1000;
  const overageUnlockedUntilPeriodEnd =
    (snap.get("overageUnlockedUntilPeriodEnd") as boolean | undefined) ?? false;

  return NextResponse.json({
    overageLimitCents,
    overageLimitDollars: overageLimitCents / 100,
    overageUnlockedUntilPeriodEnd,
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    overageLimitDollars?: number;
    overageLimitCents?: number;
  };

  let cents: number | null = null;
  if (typeof body.overageLimitCents === "number" && Number.isFinite(body.overageLimitCents)) {
    cents = Math.max(0, Math.round(body.overageLimitCents));
  } else if (
    typeof body.overageLimitDollars === "number" &&
    Number.isFinite(body.overageLimitDollars)
  ) {
    cents = Math.max(0, dollarsToCents(body.overageLimitDollars));
  }

  if (cents === null) {
    return NextResponse.json(
      { error: "Missing overageLimitDollars/overageLimitCents" },
      { status: 400 },
    );
  }

  // Keep a reasonable upper bound to avoid footguns (user can still raise later).
  const maxCents = 50000; // $500
  if (cents > maxCents) {
    return NextResponse.json(
      { error: "Overage limit too high" },
      { status: 400 },
    );
  }

  const db = getAdminDb();
  await db.collection("users").doc(userId).set(
    {
      overageLimitCents: cents,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return NextResponse.json({
    overageLimitCents: cents,
    overageLimitDollars: cents / 100,
  });
}


