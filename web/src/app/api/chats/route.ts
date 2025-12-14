import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { createChat, listChats } from "@/lib/chatStore";

export const runtime = "nodejs";

const WELCOME =
  "Paste a page URL (for example snoopgame.com or langfuse.com). I will open it in a real browser, analyze the structure and generate a CSV checklist for testing.";

export async function GET() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const chats = await listChats(userId);
  return NextResponse.json({ chats });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { title?: string; siteUrl?: string | null };
  const { chatId } = await createChat({
    userId,
    title: body.title,
    siteUrl: body.siteUrl ?? null,
    welcomeMessage: WELCOME,
  });

  return NextResponse.json({ chatId });
}


