import { NextRequest } from "next/server";
import { spawn } from "child_process";
import path from "path";
import OpenAI from "openai";
import { auth } from "@/auth";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const SYSTEM_PROMPT = `Create a detailed checklist for website page testing in CSV format.

CSV format (comma-separated):
Check,Opera GX,Chrome,Android Chrome,Android Browser,iOS Chrome,iOS Safari,MacOS Chrome,MacOS Safari,Comment

For each check create a separate row in format:
"Check description",,,,,,,,,

Example check formulations:
- "Text in <block name> displays correctly without line breaks and errors"
- "Button <button name> redirects to the correct page"
- "Image <image name> displays without artifacts"
- "Block grid does not break in responsive mode"
- "Menu opens and closes correctly"
- "All links inside the block work"

Must include checks for the following categories:

1. Texts - check each text block, heading
2. Images - each image separately
3. Blocks and sections - each page section
4. Links and navigation - each link from menu and content
5. Buttons and CTAs - each button by name
6. Styles and layout - margins, alignment, fonts
7. Mobile responsiveness - how elements behave on mobile
8. Header - all header elements
9. Footer - all footer elements
10. Forms - if there are forms and input fields

DO NOT include backend functionality.

Return ONLY CSV data, starting with the header. Generate 40-80 check items depending on page complexity.`;

function extractAllUrlsFromText(text: string): string[] {
  // Match full URLs and bare domains (e.g., snoopgame.com, https://snoopgame.com, www.snoopgame.com)
  const urlRegex =
    /(https?:\/\/[^\s]+)|((?:www\.)?[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})(\/[^\s]*)?/gi;

  const matches = text.match(urlRegex) || [];

  // Normalize and deduplicate
  const normalized = matches
    .map((raw) => {
      let url = raw.trim();
      if (!url) return null;
      if (!/^https?:\/\//i.test(url)) {
        url = `https://${url}`;
      }
      return url;
    })
    .filter((u): u is string => Boolean(u));

  return Array.from(new Set(normalized));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await req.json();
  const messages = (body?.messages ?? []) as ChatMessage[];
  const explicitUrl = (body?.url as string | undefined)?.trim();
  const requestId =
    (body?.requestId as string | undefined)?.trim() ||
    `rid-${Date.now()}-${Math.random()}`;

  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const userText = lastUser?.content ?? "";

  // Build list of URLs to process
  let urls: string[] = [];

  if (explicitUrl) {
    urls = [explicitUrl];
  } else {
    urls = extractAllUrlsFromText(userText);
  }

  urls = urls.map((u) => u.trim()).filter(Boolean);

  if (!urls.length) {
    return new Response("Please provide a URL in your message", { status: 400 });
  }

  // Reserve credits atomically before streaming any output.
  const db = getAdminDb();
  const userRef = db.collection("users").doc(userId);
  const analysisRefs = urls.map((_, idx) =>
    db.collection("analyses").doc(`${userId}_${requestId}_${idx}`),
  );
  type BillingKind = "free" | "included" | "overage";
  const billingByIndex: BillingKind[] = [];
  let stripeMeteredItemId: string | null = null;
  const overageUnitPriceCents = 40; // $0.40 per analysis

  try {
    await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      const creditsRaw = userSnap.get("freeCreditsRemaining");
      const credits =
        typeof creditsRaw === "number" ? creditsRaw : 0;
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
        typeof subStatus === "string" &&
        (subStatus === "active" || subStatus === "trialing");
      const hasMeteredItem = typeof meteredItemId === "string" && meteredItemId;

      // If we are past the period end, locally reset counters (Stripe webhook should also update).
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

      // Allocate billing per URL: free credits first, then included quota, then overage.
      const freeCount = Math.min(credits, urls.length);
      const remainingAfterFree = urls.length - freeCount;

      let includedCount = 0;
      let overageCount = 0;

      if (remainingAfterFree > 0) {
        if (hasActiveSub && hasMeteredItem) {
          stripeMeteredItemId = meteredItemId;
          const remainingIncluded = Math.max(0, includedMonthlyLimit - periodIncludedUsed);
          includedCount = Math.min(remainingIncluded, remainingAfterFree);
          overageCount = remainingAfterFree - includedCount;

          if (overageCount > 0 && !overageUnlockedUntilPeriodEnd) {
            const projectedOverageCents =
              (periodOverageUsed + periodOverageReserved + overageCount) * overageUnitPriceCents;
            if (projectedOverageCents > overageLimitCents) {
              const err = new Error("OVERAGE_CAP");
              // @ts-expect-error attach fields
              err.code = "OVERAGE_CAP";
              // @ts-expect-error attach fields
              err.details = {
                overageLimitCents,
                projectedOverageCents,
                overageUnitPriceCents,
                overageUnitsRequested: overageCount,
                unlocked: false,
              };
              throw err;
            }
          }
        } else {
          const err = new Error("PAYMENT_REQUIRED");
          // @ts-expect-error attach code
          err.code = "PAYMENT_REQUIRED";
          throw err;
        }
      }

      // Build billingByIndex in order.
      billingByIndex.length = 0;
      for (let i = 0; i < urls.length; i++) {
        if (i < freeCount) billingByIndex.push("free");
        else if (i < freeCount + includedCount) billingByIndex.push("included");
        else billingByIndex.push("overage");
      }

      // Create analysis docs (idempotency for this requestId) and decrement credits once.
      analysisRefs.forEach((ref, idx) => {
        tx.set(
          ref,
          {
            userId,
            url: urls[idx],
            requestId,
            status: "processing",
            billingMode: billingByIndex[idx],
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      });

      tx.set(
        userRef,
        { updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      );

      if (freeCount > 0) {
        tx.update(userRef, {
          freeCreditsRemaining: credits - freeCount,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      if (includedCount > 0) {
        tx.set(
          userRef,
          {
            periodIncludedUsed: periodIncludedUsed + includedCount,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      }
      if (overageCount > 0) {
        tx.set(
          userRef,
          {
            periodOverageReserved: periodOverageReserved + overageCount,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      }
    });
  } catch (e) {
    const code =
      e && typeof e === "object" && "code" in e ? (e as any).code : undefined;
    if (code === "OVERAGE_CAP") {
      const details = (e as any).details ?? {};
      return new Response(JSON.stringify({ error: "OVERAGE_CAP", ...details }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (code === "PAYMENT_REQUIRED" || (e as Error)?.message === "PAYMENT_REQUIRED") {
      return new Response("Payment required. Please upgrade to continue.", {
        status: 402,
      });
    }
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(`Failed to reserve credits: ${msg}`, { status: 500 });
  }

  const encoder = new TextEncoder();
  const stripe = stripeMeteredItemId ? getStripe() : null;
  
  const stream = new ReadableStream({
    async start(controller) {
      function sendLog(message: string) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "log", message })}\n\n`,
          ),
        );
      }

      try {
        sendLog(`📨 Received request for ${urls.length} URL(s).`);
        urls.forEach((url, index) => {
          sendLog(`🔗 [${index + 1}/${urls.length}] ${url}`);
        });

        // In Cloud Run container, cwd is /app/web, so we go up to /app
        // In local dev, cwd might be different, so we use relative path
        const isProduction = process.env.NODE_ENV === 'production';
        const projectRoot = isProduction ? '/app' : path.join(process.cwd(), "..");
        const pythonScript = path.join(projectRoot, "browser-service/analyze_page.py");
        const venvPython = path.join(projectRoot, "browser-service/venv/bin/python");

        sendLog(`📂 Project root: ${projectRoot}`);
        sendLog(`🐍 Python path: ${venvPython}`);
        sendLog(`📜 Script path: ${pythonScript}`);

        // Check if files exist
        try {
          const fs = await import('fs');
          const pythonExists = fs.existsSync(venvPython);
          const scriptExists = fs.existsSync(pythonScript);
          sendLog(`✓ Python binary exists: ${pythonExists}`);
          sendLog(`✓ Script exists: ${scriptExists}`);
        } catch (e) {
          sendLog(`⚠️ Could not check file existence: ${e}`);
        }

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
          throw new Error("OPENAI_API_KEY is not set on the server");
        }

        const openai = new OpenAI({ apiKey });

        for (let index = 0; index < urls.length; index++) {
          const url = urls[index];
          const analysisRef = analysisRefs[index];
          const billingKind = billingByIndex[index] ?? "free";

          sendLog(`🚀 [${index + 1}/${urls.length}] Preparing to launch browser for ${url}...`);

          sendLog(`🔧 Spawning Python process...`);

          const pythonProcess = spawn(venvPython, [pythonScript, url], {
            cwd: projectRoot,
            env: { ...process.env },
          });

          sendLog(`✓ Python process spawned (PID: ${pythonProcess.pid})`);

          let stdout = "";
          let stderr = "";
          let stderrLineCount = 0;

          pythonProcess.stdout.on("data", (data) => {
            stdout += data.toString();
            sendLog(`📤 [stdout] ${data.toString().substring(0, 200)}`);
          });

          pythonProcess.stderr.on("data", (data) => {
            const chunk = data.toString();
            stderr += chunk;
            stderrLineCount++;
            
            // Forward each line from Python stderr
            const lines = chunk.split('\n').filter((l: string) => l.trim());
            for (const line of lines) {
              sendLog(line);
            }
          });

          pythonProcess.on("error", (err) => {
            sendLog(`❌ Python process error: ${err.message}`);
          });

          try {
            const pythonResult = await new Promise<{ analysis: string; raw: unknown }>((resolve, reject) => {
              let timeoutHandle: NodeJS.Timeout;
              
              pythonProcess.on("close", (code, signal) => {
                clearTimeout(timeoutHandle);
                sendLog(`🏁 Python process closed for ${url} (code: ${code}, signal: ${signal})`);
                sendLog(`📊 Total stderr lines: ${stderrLineCount}`);
                sendLog(`📊 Total stdout length: ${stdout.length} chars`);

                if (code !== 0) {
                  reject(new Error(`Python exited with code ${code}. stderr: ${stderr.substring(0, 500)}`));
                  return;
                }

                try {
                  const parsed = JSON.parse(stdout);
                  if (!parsed.success) {
                    reject(new Error(parsed.error ?? "Page analysis failed"));
                    return;
                  }
                  resolve({ analysis: parsed.data, raw: parsed.raw });
                } catch (e) {
                  const message =
                    e instanceof Error ? e.message : "Unknown JSON parse error";
                  reject(new Error(`Failed to parse Python output: ${message}. First 500 chars: ${stdout.substring(0, 500)}`));
                }
              });

              timeoutHandle = setTimeout(() => {
                sendLog(`⏱️ Timeout reached, killing Python process for ${url}...`);
                pythonProcess.kill('SIGTERM');
                setTimeout(() => {
                  if (!pythonProcess.killed) {
                    sendLog(`⏱️ Force killing Python process for ${url}...`);
                    pythonProcess.kill('SIGKILL');
                  }
                }, 5000);
                reject(new Error(`Browser analysis timeout (3 minutes) for ${url}. Got ${stderrLineCount} stderr lines.`));
              }, 180000); // 3 minutes
            });

            sendLog(`✅ Page analysis complete for ${url}`);
            sendLog("🤖 Generating CSV checklist with GPT-4o...");

            const completion = await openai.chat.completions.create({
              model: "gpt-4o",
              messages: [
                { role: "system", content: SYSTEM_PROMPT },
                {
                  role: "user",
                  content: `Based on analysis of page ${url}, create a detailed checklist.\n\nHere is the page analysis:\n\n${pythonResult.analysis}`,
                },
              ],
              temperature: 0.7,
              max_tokens: 4000,
            });

            const csv = completion.choices[0]?.message?.content ?? "";

            sendLog(`✅ Checklist generated successfully for ${url}`);

            let stripeUsageRecordId: string | null = null;
            if (billingKind === "overage" && stripe && stripeMeteredItemId) {
              try {
                const usage = await stripe.rawRequest(
                  "post",
                  `/v1/subscription_items/${stripeMeteredItemId}/usage_records`,
                  {
                    quantity: 1,
                    timestamp: Math.floor(Date.now() / 1000),
                    action: "increment",
                  },
                  {
                    idempotencyKey: analysisRef.id,
                  },
                );
                stripeUsageRecordId =
                  (usage as any)?.id ?? (usage as any)?.data?.id ?? null;

                // Convert reservation → billed usage
                try {
                  await userRef.set(
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
                // If billing fails, treat as error (avoid giving free results without charging).
                const msg = err instanceof Error ? err.message : "Stripe usage record error";
                // Release reservation if Stripe billing failed
                try {
                  await userRef.set(
                    {
                      periodOverageReserved: FieldValue.increment(-1),
                      updatedAt: FieldValue.serverTimestamp(),
                    },
                    { merge: true },
                  );
                } catch {
                  // ignore
                }
                throw new Error(`Billing failed: ${msg}`);
              }
            }

            // Mark analysis as completed (store minimal metadata; full artifacts are returned to the client).
            try {
              await analysisRef.set(
                {
                  status: "completed",
                  updatedAt: FieldValue.serverTimestamp(),
                  completedAt: FieldValue.serverTimestamp(),
                  stripeUsageRecordId,
                },
                { merge: true },
              );
            } catch {
              // non-fatal
            }

            // Send result for this URL
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ 
                  type: "result", 
                  url, 
                  csv, 
                  raw: pythonResult.raw 
                })}\n\n`,
              ),
            );
          } catch (urlError) {
            const message =
              urlError instanceof Error
                ? urlError.message
                : "Unexpected error during page analysis";
            sendLog(`❌ Failed to process ${url}: ${message}`);
            const fullMessage = `Failed to process ${url}: ${message}`;
            // Release reservation for overage attempts that failed before billing.
            if (billingKind === "overage") {
              try {
                await userRef.set(
                  {
                    periodOverageReserved: FieldValue.increment(-1),
                    updatedAt: FieldValue.serverTimestamp(),
                  },
                  { merge: true },
                );
              } catch {
                // ignore
              }
            }
            try {
              await analysisRef.set(
                {
                  status: "error",
                  error: fullMessage,
                  updatedAt: FieldValue.serverTimestamp(),
                },
                { merge: true },
              );
            } catch {
              // non-fatal
            }
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "error", message: fullMessage })}\n\n`,
              ),
            );
          }
        }

        sendLog("✅ Finished processing all URLs.");
        controller.close();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unexpected error";
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "error", message })}\n\n`,
          ),
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
