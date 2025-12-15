import { NextRequest } from "next/server";
import OpenAI from "openai";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

import { auth } from "@/auth";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { getStripe } from "@/lib/stripe";
import { downloadGcsObjectToBuffer } from "@/lib/gcsClient";
import {
  createAnalysis,
  getPageSnapshotForUser,
  type AnalysisMode,
} from "@/lib/pageSnapshotStore";
import { getSystemPromptForMode } from "@/lib/analysisPrompts";

export const runtime = "nodejs";

type SSEEvent =
  | { type: "log"; message: string }
  | {
      type: "result";
      analysisId: string;
      snapshotId: string;
      mode: AnalysisMode;
      url: string;
      output: { kind: "csv"; csv: string } | { kind: "markdown"; markdown: string };
    }
  | { type: "error"; message: string };

function normalizeMode(input: unknown): AnalysisMode | null {
  return input === "qa_checklist" || input === "uiux_audit"
    ? (input as AnalysisMode)
    : null;
}

async function reserveBillingForAnalysis(params: {
  userId: string;
  analysisId: string;
}) {
  const db = getAdminDb();
  const userRef = db.collection("users").doc(params.userId);
  const analysisRef = db.collection("analyses").doc(params.analysisId);

  type BillingKind = "free" | "included" | "overage";
  let billingKind: BillingKind = "free";
  let stripeMeteredItemId: string | null = null;

  const overageUnitPriceCents = 40; // $0.40 per analysis (matches current product)

  await db.runTransaction(async (tx) => {
    const analysisSnap = await tx.get(analysisRef);
    const existingMode = analysisSnap.get("billingMode");
    if (existingMode === "free" || existingMode === "included" || existingMode === "overage") {
      billingKind = existingMode;
      stripeMeteredItemId =
        (analysisSnap.get("stripeMeteredItemId") as string | null | undefined) ?? null;
      return;
    }

    const userSnap = await tx.get(userRef);
    const creditsRaw = userSnap.get("freeCreditsRemaining");
    const credits = typeof creditsRaw === "number" ? creditsRaw : 0;

    const subStatus = userSnap.get("stripeSubscriptionStatus");
    const meteredItemId = userSnap.get("stripeMeteredItemId");
    const plan = (userSnap.get("plan") as string | null) ?? null;

    const includedMonthlyLimitRaw = userSnap.get("includedMonthlyLimit");
    const includedMonthlyLimit =
      typeof includedMonthlyLimitRaw === "number"
        ? includedMonthlyLimitRaw
        : plan === "starter"
          ? 50
          : plan === "pro"
            ? 200
            : 0;

    const periodIncludedUsedRaw = userSnap.get("periodIncludedUsed");
    const periodIncludedUsed =
      typeof periodIncludedUsedRaw === "number" ? periodIncludedUsedRaw : 0;
    const periodOverageUsedRaw = userSnap.get("periodOverageUsed");
    const periodOverageUsed =
      typeof periodOverageUsedRaw === "number" ? periodOverageUsedRaw : 0;
    const periodOverageReservedRaw = userSnap.get("periodOverageReserved");
    const periodOverageReserved =
      typeof periodOverageReservedRaw === "number" ? periodOverageReservedRaw : 0;

    const overageLimitCentsRaw = userSnap.get("overageLimitCents");
    const overageLimitCents =
      typeof overageLimitCentsRaw === "number" ? overageLimitCentsRaw : 1000;
    const overageUnlockedUntilPeriodEndRaw = userSnap.get("overageUnlockedUntilPeriodEnd");
    const overageUnlockedUntilPeriodEnd =
      typeof overageUnlockedUntilPeriodEndRaw === "boolean"
        ? overageUnlockedUntilPeriodEndRaw
        : false;

    const periodEndRaw = userSnap.get("periodEnd") as Timestamp | null | undefined;
    const periodEnd = periodEndRaw ?? null;

    const hasActiveSub =
      typeof subStatus === "string" && (subStatus === "active" || subStatus === "trialing");
    const hasMeteredItem = typeof meteredItemId === "string" && meteredItemId;

    // Reset counters if past period end (best effort; webhook should also do it).
    const nowMs = Date.now();
    if (periodEnd && nowMs > periodEnd.toMillis() + 60_000) {
      tx.set(
        userRef,
        {
          periodIncludedUsed: 0,
          periodOverageUsed: 0,
          periodOverageReserved: 0,
          overageUnlockedUntilPeriodEnd: false,
          overageUnlockConfirmedAt: null,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }

    // Allocate one unit.
    if (credits > 0) {
      billingKind = "free";
      tx.update(userRef, {
        freeCreditsRemaining: credits - 1,
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      if (!hasActiveSub || !hasMeteredItem) {
        const err = new Error("PAYMENT_REQUIRED");
        // @ts-expect-error attach code
        err.code = "PAYMENT_REQUIRED";
        throw err;
      }
      stripeMeteredItemId = meteredItemId;
      const remainingIncluded = Math.max(0, includedMonthlyLimit - periodIncludedUsed);
      if (remainingIncluded > 0) {
        billingKind = "included";
        tx.set(
          userRef,
          {
            periodIncludedUsed: periodIncludedUsed + 1,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      } else {
        billingKind = "overage";
        // cap check unless explicitly unlocked
        const projectedOverageCents =
          (periodOverageUsed + periodOverageReserved + 1) * overageUnitPriceCents;
        if (!overageUnlockedUntilPeriodEnd && projectedOverageCents > overageLimitCents) {
          const err = new Error("OVERAGE_CAP");
          // @ts-expect-error attach fields
          err.code = "OVERAGE_CAP";
          // @ts-expect-error attach fields
          err.details = {
            overageLimitCents,
            projectedOverageCents,
            overageUnitPriceCents,
            overageUnitsRequested: 1,
            unlocked: false,
          };
          throw err;
        }
        tx.set(
          userRef,
          {
            periodOverageReserved: periodOverageReserved + 1,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      }
    }

    tx.set(
      analysisRef,
      {
        billingMode: billingKind,
        stripeMeteredItemId: stripeMeteredItemId,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });

  return { billingKind, stripeMeteredItemId, overageUnitPriceCents };
}

async function releaseOverageReservation(params: { userId: string }) {
  const db = getAdminDb();
  await db
    .collection("users")
    .doc(params.userId)
    .set(
      {
        periodOverageReserved: FieldValue.increment(-1),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const body = await req.json().catch(() => null);
  const snapshotId = String(body?.snapshotId ?? "").trim();
  const mode = normalizeMode(body?.mode);
  const instruction = typeof body?.instruction === "string" ? body.instruction : "";

  if (!snapshotId) return new Response("snapshotId is required", { status: 400 });
  if (!mode) return new Response("mode is required", { status: 400 });

  const snap = await getPageSnapshotForUser({ snapshotId, userId });
  if (!snap) return new Response("Snapshot not found", { status: 404 });
  if (snap.status !== "completed") {
    return new Response("Snapshot is not ready", { status: 409 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return new Response("OPENAI_API_KEY is not set on the server", { status: 500 });

  const { analysisId } = await createAnalysis({
    userId,
    snapshotId,
    mode,
    model: "gpt-4o",
    promptVersion: "v1",
  });

  // Reserve billing before doing costly work.
  try {
    await reserveBillingForAnalysis({ userId, analysisId });
  } catch (e) {
    const code = e && typeof e === "object" && "code" in e ? (e as any).code : undefined;
    if (code === "OVERAGE_CAP") {
      const details = (e as any).details ?? {};
      return new Response(JSON.stringify({ error: "OVERAGE_CAP", ...details }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (code === "PAYMENT_REQUIRED" || (e as Error)?.message === "PAYMENT_REQUIRED") {
      return new Response("Payment required. Please upgrade to continue.", { status: 402 });
    }
    const msg = e instanceof Error ? e.message : "Failed to reserve credits";
    return new Response(`Failed to reserve credits: ${msg}`, { status: 500 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (evt: SSEEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(evt)}\n\n`));
      };

      send({ type: "log", message: `🧠 Starting ${mode} analysis...` });

      let billingKind: "free" | "included" | "overage" = "free";
      let stripeMeteredItemId: string | null = null;
      try {
        // Read billingMode decided in transaction
        const db = getAdminDb();
        const analysisSnap = await db.collection("analyses").doc(analysisId).get();
        const bm = analysisSnap.get("billingMode");
        if (bm === "free" || bm === "included" || bm === "overage") billingKind = bm;
        const sm = analysisSnap.get("stripeMeteredItemId");
        stripeMeteredItemId = typeof sm === "string" ? sm : null;

        // Fetch artifacts from GCS
        send({ type: "log", message: "📦 Loading snapshot artifacts..." });
        const [htmlBuf, jsonBuf] = await Promise.all([
          downloadGcsObjectToBuffer({ bucket: snap.gcs.bucket, objectPath: snap.gcs.htmlPath }),
          downloadGcsObjectToBuffer({ bucket: snap.gcs.bucket, objectPath: snap.gcs.jsonPath }),
        ]);

        const html = htmlBuf.toString("utf8");
        const extracted = jsonBuf.toString("utf8");

        send({ type: "log", message: "🤖 Calling OpenAI..." });
        const openai = new OpenAI({ apiKey });
        const system = getSystemPromptForMode(mode);

        const userContent =
          mode === "qa_checklist"
            ? `Create a checklist for: ${snap.normalizedUrl}\n\nPage title: ${snap.title ?? ""}\n\nExtracted JSON:\n${extracted}\n\nHTML (may be long):\n${html}`
            : `Audit this page: ${snap.normalizedUrl}\n\nPage title: ${snap.title ?? ""}\n\nUser instruction (optional): ${instruction}\n\nExtracted JSON:\n${extracted}\n\nHTML:\n${html}`;

        const completion = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: system },
            { role: "user", content: userContent },
          ],
          temperature: 0.5,
          max_tokens: 4000,
        });

        const text = completion.choices[0]?.message?.content ?? "";
        if (!text.trim()) {
          throw new Error("Empty model response");
        }

        // If overage, finalize billing with Stripe usage record (idempotent).
        let stripeUsageRecordId: string | null = null;
        if (billingKind === "overage" && stripeMeteredItemId) {
          send({ type: "log", message: "💳 Recording Stripe usage..." });
          const stripe = getStripe();
          try {
            const usage = await stripe.rawRequest(
              "post",
              `/v1/subscription_items/${stripeMeteredItemId}/usage_records`,
              {
                quantity: 1,
                timestamp: Math.floor(Date.now() / 1000),
                action: "increment",
              },
              { idempotencyKey: analysisId },
            );
            stripeUsageRecordId =
              (usage as any)?.id ?? (usage as any)?.data?.id ?? null;

            // reservation -> used
            try {
              await db
                .collection("users")
                .doc(userId)
                .set(
                  {
                    periodOverageUsed: FieldValue.increment(1),
                    periodOverageReserved: FieldValue.increment(-1),
                    updatedAt: FieldValue.serverTimestamp(),
                  },
                  { merge: true },
                );
            } catch {
              // non-fatal
            }
          } catch (err) {
            // release reservation if Stripe billing failed
            await releaseOverageReservation({ userId }).catch(() => {});
            const msg = err instanceof Error ? err.message : "Stripe usage record error";
            throw new Error(`Billing failed: ${msg}`);
          }
        }

        // Persist and send result
        await db
          .collection("analyses")
          .doc(analysisId)
          .set(
            {
              status: "completed",
              updatedAt: FieldValue.serverTimestamp(),
              completedAt: FieldValue.serverTimestamp(),
              stripeUsageRecordId,
              resultInline:
                mode === "qa_checklist"
                  ? { kind: "csv", csv: text }
                  : { kind: "markdown", markdown: text },
            },
            { merge: true },
          );

        send({
          type: "result",
          analysisId,
          snapshotId,
          mode,
          url: snap.normalizedUrl,
          output:
            mode === "qa_checklist"
              ? { kind: "csv", csv: text }
              : { kind: "markdown", markdown: text },
        });

        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unexpected error";
        // If we failed after reserving overage but before billing usage record, release reservation.
        if (billingKind === "overage") {
          await releaseOverageReservation({ userId }).catch(() => {});
        }
        try {
          const db = getAdminDb();
          await db
            .collection("analyses")
            .doc(analysisId)
            .set(
              {
                status: "error",
                error: msg,
                updatedAt: FieldValue.serverTimestamp(),
              },
              { merge: true },
            );
        } catch {
          // ignore
        }
        send({ type: "error", message: msg });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}


