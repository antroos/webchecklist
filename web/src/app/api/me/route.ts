import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getUserCredits } from "@/lib/userStore";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const freeCreditsRemaining = await getUserCredits(userId);
  return NextResponse.json({
    userId,
    freeCreditsRemaining,
  });
}



