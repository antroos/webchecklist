import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { appendMessage, listMessages, maybeSetChatTitleFromFirstUserMessage } from "@/lib/chatStore";

export const runtime = "nodejs";

function maskId(id: string) {
  if (!id) return "";
  if (id.length <= 6) return "***";
  return `***${id.slice(-6)}`;
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ chatId: string }> | { chatId: string } }) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const p: any = (ctx as any)?.params;
  const chatId = typeof p?.then === "function" ? (await p).chatId : p?.chatId;
  if (!chatId) return NextResponse.json({ error: "Missing chatId" }, { status: 400 });

  // #region agent log
  console.log(
    JSON.stringify({
      tag: "WMDBG",
      runId: "run1",
      hypothesisId: "H-B",
      location: "web/src/app/api/chats/[chatId]/messages/route.ts:GET",
      message: "listMessages.start",
      data: { userId: maskId(userId), chatId: `***${String(chatId).slice(-6)}` },
      timestamp: Date.now(),
    }),
  );
  // #endregion agent log

  const messages = await listMessages({ userId, chatId, limit: 400 });

  // #region agent log
  console.log(
    JSON.stringify({
      tag: "WMDBG",
      runId: "run1",
      hypothesisId: "H-B",
      location: "web/src/app/api/chats/[chatId]/messages/route.ts:GET",
      message: "listMessages.done",
      data: {
        userId: maskId(userId),
        chatId: `***${String(chatId).slice(-6)}`,
        count: Array.isArray(messages) ? messages.length : -1,
      },
      timestamp: Date.now(),
    }),
  );
  // #endregion agent log

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

  // #region agent log
  console.log(
    JSON.stringify({
      tag: "WMDBG",
      runId: "run1",
      hypothesisId: "H-C",
      location: "web/src/app/api/chats/[chatId]/messages/route.ts:POST",
      message: "appendMessage.done",
      data: {
        userId: maskId(userId),
        chatId: `***${String(chatId).slice(-6)}`,
        role,
        kind,
        contentLen: typeof content === "string" ? content.length : -1,
        hasArtifacts: Boolean(body.artifacts),
        hasHtml: typeof body.artifacts?.html === "string",
        hasRaw: typeof body.artifacts?.raw !== "undefined",
        messageId: messageId ? `***${String(messageId).slice(-6)}` : null,
      },
      timestamp: Date.now(),
    }),
  );
  // #endregion agent log

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


