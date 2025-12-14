import { redirect } from "next/navigation";

import { auth } from "@/auth";
import AppClient from "./AppClient";

const WMDBG_ENDPOINT =
  "http://127.0.0.1:7242/ingest/e38c11ec-9fba-420e-88d7-64588137f26f";

export default async function AppPage({
  searchParams,
}: {
  // Next 16 can provide searchParams as a Promise in server components.
  // Keep it flexible so reload/navigation doesn't accidentally drop chatId.
  searchParams?:
    | Promise<Record<string, string | string[] | undefined>>
    | Record<string, string | string[] | undefined>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/auth/signin?callbackUrl=/app");
  }

  // #region agent log
  console.log(
    JSON.stringify({
      tag: "WMDBG",
      runId: "run1",
      hypothesisId: "H-A",
      location: "web/src/app/app/page.tsx",
      message: "AppPage.searchParams",
      data: { searchParamsType: typeof (searchParams as any)?.then === "function" ? "promise" : typeof searchParams },
      timestamp: Date.now(),
    }),
  );
  // #endregion agent log

  // #region agent log
  if (process.env.NODE_ENV !== "production") {
    fetch(WMDBG_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "H-A",
        location: "web/src/app/app/page.tsx:searchParams",
        message: "AppPage.searchParams",
        data: {
          searchParamsType:
            typeof (searchParams as any)?.then === "function" ? "promise" : typeof searchParams,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  }
  // #endregion agent log

  const spAny: any = searchParams as any;
  const resolved: Record<string, string | string[] | undefined> | undefined =
    typeof spAny?.then === "function" ? await spAny : spAny;

  const rawChatId = resolved?.chatId;
  const chatId =
    typeof rawChatId === "string" && rawChatId.trim() ? rawChatId : null;

  // #region agent log
  console.log(
    JSON.stringify({
      tag: "WMDBG",
      runId: "run1",
      hypothesisId: "H-A",
      location: "web/src/app/app/page.tsx",
      message: "AppPage.chatId",
      data: { hasChatId: Boolean(chatId) },
      timestamp: Date.now(),
    }),
  );
  // #endregion agent log

  // #region agent log
  if (process.env.NODE_ENV !== "production") {
    fetch(WMDBG_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "H-A",
        location: "web/src/app/app/page.tsx:chatId",
        message: "AppPage.chatId",
        data: {
          hasChatId: Boolean(chatId),
          chatIdTail: chatId ? String(chatId).slice(-6) : null,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  }
  // #endregion agent log

  return <AppClient chatId={chatId} />;
}


