import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { appendMessage, listMessages, maybeSetChatTitleFromFirstUserMessage } from "@/lib/chatStore";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ chatId: string }> | { chatId: string } }) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const p: any = (ctx as any)?.params;
  const chatId = typeof p?.then === "function" ? (await p).chatId : p?.chatId;
  if (!chatId) return NextResponse.json({ error: "Missing chatId" }, { status: 400 });

  const messages = await listMessages({ userId, chatId, limit: 400 });
  return NextResponse.json({ messages });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ chatId: string }> | { chatId: string } }) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const p: any = (ctx as any)?.params;
  const chatId = typeof p?.then === "function" ? (await p).chatId : p?.chatId;
  if (!chatId) return NextResponse.json({ error: "Missing chatId" }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as {
    role?: "user" | "assistant";
    kind?: "status" | "result" | "plain";
    content?: string;
    artifacts?: { csv?: string; raw?: unknown; html?: string };
  };

  const role = body.role === "user" || body.role === "assistant" ? body.role : null;
  const kind = body.kind === "status" || body.kind === "result" || body.kind === "plain" ? body.kind : null;
  const content = typeof body.content === "string" ? body.content : "";
  if (!role || !kind || !content.trim()) {
    return NextResponse.json({ error: "Missing role/kind/content" }, { status: 400 });
  }

  const { messageId } = await appendMessage({
    userId,
    chatId,
    role,
    kind,
    content,
    artifacts: body.artifacts,
  });

  if (role === "user" && kind === "plain") {
    // Best-effort: if chat is still the default title, rename it based on the first user message.
    void maybeSetChatTitleFromFirstUserMessage({
      userId,
      chatId,
      userMessage: content,
    });
  }

  return NextResponse.json({ ok: true, messageId });
}


