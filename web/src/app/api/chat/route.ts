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
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as ReqBody;
  const chatId = typeof body.chatId === "string" ? body.chatId.trim() : "";
  if (!chatId) return NextResponse.json({ error: "Missing chatId" }, { status: 400 });

  const model = typeof body.model === "string" && body.model.trim() ? body.model.trim() : "gpt-5.2";

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
}


