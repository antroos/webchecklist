import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { deleteChat, updateChatMeta } from "@/lib/chatStore";
import { isMentorId } from "@/lib/mentors";

export const runtime = "nodejs";

async function getChatId(ctx: unknown): Promise<string | null> {
  const p: any = (ctx as any)?.params;
  const chatId = typeof p?.then === "function" ? (await p).chatId : p?.chatId;
  return typeof chatId === "string" && chatId.trim() ? chatId : null;
}

export async function GET(_req: NextRequest, ctx: unknown) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const chatId = await getChatId(ctx);
  if (!chatId) return NextResponse.json({ error: "Missing chatId" }, { status: 400 });

  // Minimal meta endpoint. The client uses it to restore per-chat mentor selection.
  const { getAdminDb } = await import("@/lib/firebaseAdmin");
  const db = getAdminDb();
  const ref = db.collection("users").doc(userId).collection("chats").doc(chatId);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ error: "NotFound" }, { status: 404 });

  const mentorId = (snap.get("mentorId") as string | undefined) ?? "general";
  const title = (snap.get("title") as string | undefined) ?? "New chat";
  return NextResponse.json({ id: chatId, title, mentorId });
}

export async function PATCH(req: NextRequest, ctx: unknown) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const chatId = await getChatId(ctx);
  if (!chatId) return NextResponse.json({ error: "Missing chatId" }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as { title?: string; mentorId?: string };
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const mentorId = typeof body.mentorId === "string" ? body.mentorId.trim() : "";

  if (!title && !mentorId) {
    return NextResponse.json({ error: "Missing title or mentorId" }, { status: 400 });
  }

  const patch: { title?: string; mentorId?: string } = {};
  if (title) patch.title = title;
  if (mentorId) {
    if (!isMentorId(mentorId)) return NextResponse.json({ error: "Invalid mentorId" }, { status: 400 });
    patch.mentorId = mentorId;
  }

  await updateChatMeta({ userId, chatId, ...patch });
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


