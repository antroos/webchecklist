import { NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { convertToModelMessages, streamText } from "ai";

import { auth } from "@/auth";
import { appendMessage } from "@/lib/chatStore";

export const runtime = "nodejs";

type ReqBody = {
  chatId?: string;
  model?: string;
  messages?: Array<{ role?: string; content?: unknown }>;
  // optional future
  mode?: string;
};

function asTextContent(v: unknown): string {
  if (typeof v === "string") return v;
  // assistant-ui may send richer structures later; MVP: stringify safely.
  try {
    return JSON.stringify(v);
  } catch {
    return String(v ?? "");
  }
}

type SimpleMsg = { role: "user" | "assistant"; content: string };

function toSimpleMessages(input: ReqBody["messages"]): SimpleMsg[] {
  const arr = Array.isArray(input) ? input : [];
  const out: SimpleMsg[] = [];
  for (const m of arr) {
    const role = m?.role === "assistant" ? "assistant" : "user";
    const content = asTextContent(m?.content);
    if (!content.trim()) continue;
    out.push({ role, content });
  }
  return out;
}

function getBasePrompt(): string {
  const p = (process.env.APP_BASE_PROMPT || "").trim();
  if (p) return p;
  return [
    "You are a helpful assistant inside a product.",
    "Be concise, practical, and structured.",
  ].join("\n");
}

export async function POST(req: Request) {
  try {
  // #region agent log
  // Server-side code runs on Cloud Run, so it cannot reach the local debug ingest endpoint.
  // Keep this instrumentation gated for local debugging only.
  if (process.env.WMDBG_LOCAL === "1") {
    fetch("http://127.0.0.1:7242/ingest/e38c11ec-9fba-420e-88d7-64588137f26f", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "debug-session",
        runId: "run-chat-1",
        hypothesisId: "H1",
        location: "web/src/app/api/chat/route.ts:POST:entry",
        message: "api.chat.entry",
        data: { hasEnvKey: Boolean(process.env.OPENAI_API_KEY), nodeEnv: process.env.NODE_ENV },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  }
  // #endregion agent log

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY_MISSING" },
      { status: 500 },
    );
  }

  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    // #region agent log
    if (process.env.WMDBG_LOCAL === "1") {
      fetch("http://127.0.0.1:7242/ingest/e38c11ec-9fba-420e-88d7-64588137f26f", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "debug-session",
          runId: "run-chat-1",
          hypothesisId: "H3",
          location: "web/src/app/api/chat/route.ts:POST:auth",
          message: "api.chat.unauthorized",
          data: {},
          timestamp: Date.now(),
        }),
      }).catch(() => {});
    }
    // #endregion agent log
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as ReqBody;
  const chatId = typeof body.chatId === "string" ? body.chatId.trim() : "";
  if (!chatId) {
    // #region agent log
    if (process.env.WMDBG_LOCAL === "1") {
      fetch("http://127.0.0.1:7242/ingest/e38c11ec-9fba-420e-88d7-64588137f26f", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "debug-session",
          runId: "run-chat-1",
          hypothesisId: "H2",
          location: "web/src/app/api/chat/route.ts:POST:body",
          message: "api.chat.missingChatId",
          data: { bodyKeys: body ? Object.keys(body) : null },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
    }
    // #endregion agent log
    return NextResponse.json({ error: "Missing chatId" }, { status: 400 });
  }

  const model = typeof body.model === "string" && body.model.trim() ? body.model.trim() : "gpt-5.2";
  // #region agent log
  if (process.env.WMDBG_LOCAL === "1") {
    fetch("http://127.0.0.1:7242/ingest/e38c11ec-9fba-420e-88d7-64588137f26f", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "debug-session",
        runId: "run-chat-1",
        hypothesisId: "H1",
        location: "web/src/app/api/chat/route.ts:POST:parsed",
        message: "api.chat.parsed",
        data: {
          chatIdTail: chatId.slice(-6),
          model,
          hasMessages: Array.isArray(body.messages),
          messagesLen: Array.isArray(body.messages) ? body.messages.length : -1,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  }
  // #endregion agent log

  const simpleMessages = toSimpleMessages(body.messages);
  const last = simpleMessages[simpleMessages.length - 1];
  if (!last || last.role !== "user") {
    return NextResponse.json({ error: "Missing user message" }, { status: 400 });
  }

  // Persist user message (best-effort). We may get duplicates on retries; acceptable for MVP.
  try {
    await appendMessage({
      userId,
      chatId,
      role: "user",
      kind: "plain",
      content: last.content,
    });
  } catch {
    // ignore
  }

  const basePrompt = getBasePrompt();
  const converted = convertToModelMessages(simpleMessages as any);

  try {
    const result = streamText({
      model: openai(model),
      system: basePrompt,
      messages: converted,
      // Persist assistant message at the end of streaming.
      onFinish: async (evt) => {
        const text = (evt?.text || "").trim();
        if (!text) return;
        try {
          await appendMessage({
            userId,
            chatId,
            role: "assistant",
            kind: "plain",
            content: text,
          });
        } catch {
          // ignore
        }
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // #region agent log
    if (process.env.WMDBG_LOCAL === "1") {
      fetch("http://127.0.0.1:7242/ingest/e38c11ec-9fba-420e-88d7-64588137f26f", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "debug-session",
          runId: "run-chat-1",
          hypothesisId: "H1",
          location: "web/src/app/api/chat/route.ts:POST:catch",
          message: "api.chat.streamText.error",
          data: { errorMessage: msg.slice(0, 500) },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
    }
    // #endregion agent log
    return NextResponse.json({ error: "CHAT_FAILED", message: msg }, { status: 500 });
  }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "CHAT_HANDLER_FAILED", message: msg },
      { status: 500 },
    );
  }
}


