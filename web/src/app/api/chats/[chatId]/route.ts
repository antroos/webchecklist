import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { deleteChat, updateChatMeta } from "@/lib/chatStore";

export const runtime = "nodejs";

async function getChatId(ctx: unknown): Promise<string | null> {
  const p: any = (ctx as any)?.params;
  const chatId = typeof p?.then === "function" ? (await p).chatId : p?.chatId;
  return typeof chatId === "string" && chatId.trim() ? chatId : null;
}

export async function PATCH(req: NextRequest, ctx: unknown) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const chatId = await getChatId(ctx);
  if (!chatId) return NextResponse.json({ error: "Missing chatId" }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as { title?: string };
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return NextResponse.json({ error: "Missing title" }, { status: 400 });

  await updateChatMeta({ userId, chatId, title });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: unknown) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const chatId = await getChatId(ctx);
  if (!chatId) return NextResponse.json({ error: "Missing chatId" }, { status: 400 });

  await deleteChat({ userId, chatId });
  return NextResponse.json({ ok: true });
}


