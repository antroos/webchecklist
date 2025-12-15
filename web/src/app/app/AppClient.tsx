"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";

import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  type ThreadMessage,
} from "@assistant-ui/react";
import { AssistantChatTransport, useChatRuntime } from "@assistant-ui/react-ai-sdk";
import type { UIMessage } from "ai";

import SidebarNav from "./sidebar/SidebarNav";
import ChatList from "./sidebar/ChatList";

type PersistedMessage = {
  id: string;
  role: "user" | "assistant";
  kind?: "status" | "result" | "plain";
  content: string;
};

function toUiMessages(messages: PersistedMessage[]): UIMessage[] {
  return messages.map((m) => ({
    id: m.id,
    role: m.role,
    parts: [{ type: "text", text: m.content, state: "done" }],
  }));
}

function UserBubble() {
  return (
    <MessagePrimitive.Root className="flex justify-end">
      <div className="max-w-[92%] rounded-2xl border border-[color:rgba(97,106,243,0.22)] bg-[color:rgba(97,106,243,0.12)] px-3 py-2 text-sm text-[color:rgba(11,18,32,0.92)] shadow-sm md:max-w-3xl">
        <MessagePrimitive.Parts
          components={{
            Reasoning: () => null,
          }}
        />
      </div>
    </MessagePrimitive.Root>
  );
}

function AssistantBubble() {
  return (
    <MessagePrimitive.Root className="flex justify-start">
      <div className="max-w-[92%] rounded-2xl border border-[color:rgba(15,23,42,0.10)] bg-[color:rgba(255,255,255,0.88)] px-3 py-2 text-sm text-[color:rgba(11,18,32,0.90)] shadow-sm md:max-w-3xl">
        <MessagePrimitive.Parts
          components={{
            Reasoning: () => null,
          }}
        />
      </div>
    </MessagePrimitive.Root>
  );
}

function Composer() {
  return (
    <ComposerPrimitive.Root className="rounded-3xl border border-[color:rgba(15,23,42,0.12)] bg-white/95 p-3 shadow-[0_14px_40px_rgba(15,23,42,0.10)]">
      <ComposerPrimitive.Input className="min-h-[54px] w-full resize-none rounded-2xl border border-[color:rgba(15,23,42,0.10)] bg-white px-4 py-3 text-[15px] leading-relaxed text-[color:rgba(11,18,32,0.92)] outline-none placeholder:text-[color:rgba(11,18,32,0.45)] focus:border-[color:rgba(97,106,243,0.60)] focus:shadow-[0_0_0_4px_rgba(97,106,243,0.14)]" />
      <div className="mt-3 flex items-center justify-end gap-2">
        <ComposerPrimitive.Cancel className="hidden" />
        <ComposerPrimitive.Send className="h-10 rounded-xl bg-[color:rgba(15,23,42,0.90)] px-4 text-sm font-medium text-white hover:bg-[color:rgba(15,23,42,0.82)]">
          Send
        </ComposerPrimitive.Send>
      </div>
    </ComposerPrimitive.Root>
  );
}

function Suggestions() {
  return (
    <div className="flex flex-wrap gap-2">
      <ThreadPrimitive.Suggestion
        prompt="Проаналізуй UI/UX і дай 5 пріоритетних покращень."
        send
        className="rounded-full border border-[color:rgba(15,23,42,0.10)] bg-white/90 px-3 py-2 text-[12px] font-semibold text-[color:rgba(11,18,32,0.82)] hover:bg-white"
      >
        UI/UX audit
      </ThreadPrimitive.Suggestion>
      <ThreadPrimitive.Suggestion
        prompt="Зроби чекліст для QA тестування цієї сторінки."
        send
        className="rounded-full border border-[color:rgba(15,23,42,0.10)] bg-white/90 px-3 py-2 text-[12px] font-semibold text-[color:rgba(11,18,32,0.82)] hover:bg-white"
      >
        QA checklist
      </ThreadPrimitive.Suggestion>
      <ThreadPrimitive.Suggestion
        prompt="Скажи коротко: що тут головне і яка ціль цієї сторінки?"
        send
        className="rounded-full border border-[color:rgba(15,23,42,0.10)] bg-white/90 px-3 py-2 text-[12px] font-semibold text-[color:rgba(11,18,32,0.82)] hover:bg-white"
      >
        Page goal
      </ThreadPrimitive.Suggestion>
    </div>
  );
}

function ChatThread({
  chatId,
  initialMessages,
  model,
}: {
  chatId: string;
  initialMessages: UIMessage[];
  model: string;
}) {
  const transport = useMemo(
    () =>
      new AssistantChatTransport({
        api: "/api/chat",
        body: { chatId, model },
        fetch: async (input, init) => {
          const url = typeof input === "string" ? input : input instanceof Request ? input.url : "";
          const res = await fetch(input as any, init as any);
          if (url.includes("/api/chat") && !res.ok) {
            // #region agent log
            const cloned = res.clone();
            const text = await cloned.text().catch(() => "");
            fetch("http://127.0.0.1:7242/ingest/e38c11ec-9fba-420e-88d7-64588137f26f", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                sessionId: "debug-session",
                runId: "run-chat-2",
                hypothesisId: "H1",
                location: "web/src/app/app/AppClient.tsx:transport.fetch",
                message: "client.apiChat.error",
                data: {
                  status: res.status,
                  statusText: res.statusText,
                  contentType: res.headers.get("content-type"),
                  bodyPrefix: text.slice(0, 1200),
                  chatIdTail: chatId.slice(-6),
                  model,
                },
                timestamp: Date.now(),
              }),
            }).catch(() => {});
            // #endregion agent log
          }
          return res;
        },
      }),
    [chatId, model],
  );

  const runtime = useChatRuntime({
    transport,
    messages: initialMessages,
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadPrimitive.Root className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <ThreadPrimitive.Viewport className="min-h-0 flex-1 overflow-y-auto rounded-3xl border border-[color:rgba(15,23,42,0.10)] bg-[color:rgba(15,23,42,0.02)] p-4">
          <ThreadPrimitive.Messages
            components={{
              UserMessage: UserBubble,
              AssistantMessage: AssistantBubble,
            }}
          />
        </ThreadPrimitive.Viewport>

        <div className="sticky bottom-0 mt-3 bg-[color:var(--card)] pt-2 pb-[calc(env(safe-area-inset-bottom)+8px)]">
          <div className="mb-2">
            <Suggestions />
          </div>
          <Composer />
        </div>
      </ThreadPrimitive.Root>
    </AssistantRuntimeProvider>
  );
}

export default function AppClient({ chatId }: { chatId: string | null }) {
  const activeChatId = typeof chatId === "string" && chatId.trim() ? chatId : "";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [persisted, setPersisted] = useState<PersistedMessage[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // MVP: only one model exposed, but keep the selector shape for future expansion.
  const [model, setModel] = useState("gpt-5.2");

  useEffect(() => {
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/e38c11ec-9fba-420e-88d7-64588137f26f", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "debug-session",
        runId: "run-chat-1",
        hypothesisId: "H4",
        location: "web/src/app/app/AppClient.tsx:mount",
        message: "appclient.mount",
        data: {
          propChatIdTail: activeChatId ? activeChatId.slice(-6) : null,
          hrefHasChatId: typeof window !== "undefined" ? window.location.href.includes("chatId=") : null,
          viewport:
            typeof window !== "undefined"
              ? { w: window.innerWidth, h: window.innerHeight }
              : null,
        },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion agent log
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeChatId) return;
    let cancelled = false;
    setError(null);
    setLoading(true);
      // #region agent log
    fetch("http://127.0.0.1:7242/ingest/e38c11ec-9fba-420e-88d7-64588137f26f", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "debug-session",
        runId: "run-chat-1",
        hypothesisId: "H4",
        location: "web/src/app/app/AppClient.tsx:fetchMessages",
        message: "appclient.fetchMessages.start",
        data: { chatIdTail: activeChatId.slice(-6) },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
      // #endregion agent log
    fetch(`/api/chats/${encodeURIComponent(activeChatId)}/messages`)
      .then(async (r) => {
        if (!r.ok) {
          const t = await r.text().catch(() => "");
          throw new Error(`Failed to load messages: HTTP ${r.status} ${t}`);
        }
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        const msgs = Array.isArray(data?.messages) ? (data.messages as PersistedMessage[]) : [];
        setPersisted(
          msgs
            .filter((m) => m && (m.role === "user" || m.role === "assistant"))
            .map((m) => ({
              id: String((m as any).id ?? crypto.randomUUID()),
              role: m.role,
              kind: (m as any).kind ?? "plain",
              content: String((m as any).content ?? ""),
            })),
        );
        // #region agent log
        fetch("http://127.0.0.1:7242/ingest/e38c11ec-9fba-420e-88d7-64588137f26f", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: "debug-session",
            runId: "run-chat-1",
            hypothesisId: "H4",
            location: "web/src/app/app/AppClient.tsx:fetchMessages",
            message: "appclient.fetchMessages.done",
            data: { chatIdTail: activeChatId.slice(-6), count: msgs.length },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        // #endregion agent log
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load messages");
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeChatId]);

  const initialMessages = useMemo(() => toUiMessages(persisted), [persisted]);

      return (
    <div className="flex min-h-0 w-full flex-1 flex-col rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--card)] p-4 shadow-[var(--shadow)]">
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
              <button
                type="button"
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-black/30"
          />
          <div className="absolute left-0 top-0 h-full w-[86%] max-w-[340px] overflow-hidden bg-[color:var(--bg)] shadow-[var(--shadow)]">
            <div className="flex h-full flex-col p-4">
              <div className="flex items-center justify-between gap-3">
                <Link href="/app" onClick={() => setDrawerOpen(false)} className="text-sm font-semibold">
                  WebMorpher
                </Link>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="h-9 w-9 rounded-xl border border-[color:rgba(15,23,42,0.12)] bg-white/85 text-[color:rgba(11,18,32,0.78)]"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
                <SidebarNav />
                <ChatList onNavigate={() => setDrawerOpen(false)} />
              </div>
            </div>
          </div>
        </div>
      )}

      <header className="mb-3 flex items-center justify-between gap-3 border-b border-[color:rgba(15,23,42,0.08)] pb-2">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[color:rgba(15,23,42,0.12)] bg-white/85 text-[color:rgba(11,18,32,0.78)] md:hidden"
            aria-label="Open menu"
          >
            ☰
          </button>
          <div className="min-w-0">
            <div className="text-sm font-semibold">Chat</div>
          <div className="text-[11px] text-[color:rgba(11,18,32,0.60)]">
            Cursor-like chat. One input. Streaming answers.
          </div>
        </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="h-8 rounded-lg border border-[color:rgba(15,23,42,0.12)] bg-white/85 px-2 text-[12px] font-semibold text-[color:rgba(11,18,32,0.84)]"
          >
            <option value="gpt-5.2">GPT-5.2</option>
          </select>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="h-8 rounded-lg border border-[color:rgba(15,23,42,0.12)] bg-white/85 px-3 text-[12px] font-semibold text-[color:rgba(11,18,32,0.84)] hover:bg-white"
          >
            Sign out
          </button>
        </div>
      </header>

      {!activeChatId ? (
        <div className="flex flex-1 items-center justify-center text-sm text-[color:rgba(11,18,32,0.60)]">
          Create or select a chat.
        </div>
      ) : (
        <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
        {error && (
            <div className="mb-2 rounded-lg border border-[color:rgba(239,68,68,0.25)] bg-[color:rgba(239,68,68,0.08)] px-3 py-2 text-xs text-[color:rgba(185,28,28,0.95)]">
            {error}
          </div>
        )}
          {loading ? (
            <div className="flex flex-1 items-center justify-center text-sm text-[color:rgba(11,18,32,0.60)]">
              Loading…
            </div>
          ) : (
            <ChatThread
              key={`${activeChatId}:${model}:${initialMessages.length}`}
              chatId={activeChatId}
              initialMessages={initialMessages}
              model={model}
            />
          )}
        </div>
      )}
    </div>
  );
}


