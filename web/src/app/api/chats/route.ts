import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { createChat, listChats } from "@/lib/chatStore";

export const runtime = "nodejs";

const WELCOME =
  "Paste a page URL (for example snoopgame.com or langfuse.com). I will open it in a real browser, analyze the structure and generate a CSV checklist for testing.";

function maskId(id: string) {
  if (!id) return "";
  if (id.length <= 6) return "***";
  return `***${id.slice(-6)}`;
}

export async function GET() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // #region agent log
  console.log(
    JSON.stringify({
      tag: "WMDBG",
      runId: "run1",
      hypothesisId: "H-B",
      location: "web/src/app/api/chats/route.ts:GET",
      message: "listChats.start",
      data: { userId: maskId(userId) },
      timestamp: Date.now(),
    }),
  );
  // #endregion agent log

  const chats = await listChats(userId);

  // #region agent log
  console.log(
    JSON.stringify({
      tag: "WMDBG",
      runId: "run1",
      hypothesisId: "H-B",
      location: "web/src/app/api/chats/route.ts:GET",
      message: "listChats.done",
      data: { userId: maskId(userId), count: Array.isArray(chats) ? chats.length : -1 },
      timestamp: Date.now(),
    }),
  );
  // #endregion agent log

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

  // #region agent log
  console.log(
    JSON.stringify({
      tag: "WMDBG",
      runId: "run1",
      hypothesisId: "H-A",
      location: "web/src/app/api/chats/route.ts:POST",
      message: "createChat.done",
      data: { userId: maskId(userId), chatId: chatId ? `***${chatId.slice(-6)}` : null },
      timestamp: Date.now(),
    }),
  );
  // #endregion agent log

  return NextResponse.json({ chatId });
}


