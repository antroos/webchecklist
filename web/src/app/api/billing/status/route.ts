import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAdminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

function centsToDollars(cents: number) {
  return Math.round(cents) / 100;
}

export async function GET() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getAdminDb();
  const snap = await db.collection("users").doc(userId).get();
  if (!snap.exists) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const plan = (snap.get("plan") as string | null) ?? null;
  const includedMonthlyLimit = (snap.get("includedMonthlyLimit") as number | undefined) ?? 0;
  const periodIncludedUsed = (snap.get("periodIncludedUsed") as number | undefined) ?? 0;
  const periodOverageUsed = (snap.get("periodOverageUsed") as number | undefined) ?? 0;
  const periodOverageReserved = (snap.get("periodOverageReserved") as number | undefined) ?? 0;
  const overageLimitCents = (snap.get("overageLimitCents") as number | undefined) ?? 1000;
  const overageUnlockedUntilPeriodEnd =
    (snap.get("overageUnlockedUntilPeriodEnd") as boolean | undefined) ?? false;
  const periodEnd = snap.get("periodEnd") ?? null;

  const includedRemaining = Math.max(0, includedMonthlyLimit - periodIncludedUsed);
  const overageUnitPriceCents = 40;
  const overageSpentCents = (periodOverageUsed + periodOverageReserved) * overageUnitPriceCents;

  return NextResponse.json({
    userId,
    plan,
    includedMonthlyLimit,
    periodIncludedUsed,
    includedRemaining,
    periodEnd,
    overageUnitPriceCents,
    overageLimitCents,
    overageLimitDollars: centsToDollars(overageLimitCents),
    overageUnlockedUntilPeriodEnd,
    periodOverageUsed,
    periodOverageReserved,
    overageSpentCents,
    overageSpentDollars: centsToDollars(overageSpentCents),
  });
}


