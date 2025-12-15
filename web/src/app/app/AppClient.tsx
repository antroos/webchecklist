"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  type ThreadMessage,
  useAssistantApi,
  useAssistantState,
} from "@assistant-ui/react";
import { AssistantChatTransport, useChatRuntime } from "@assistant-ui/react-ai-sdk";
import type { UIMessage } from "ai";

import ChatList from "./sidebar/ChatList";
import MentorsNav from "./sidebar/MentorsNav";
import { isMentorId, type MentorId } from "@/lib/mentors";

type PersistedMessage = {
  id: string;
  role: "user" | "assistant";
  kind?: "status" | "result" | "plain";
  content: string;
};

function MarkdownText({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => (
          <p className="whitespace-pre-wrap break-words leading-relaxed">
            {children}
          </p>
        ),
        li: ({ children }) => (
          <li className="ml-5 list-disc whitespace-pre-wrap break-words">
            {children}
          </li>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold">{children}</strong>
        ),
        em: ({ children }) => <em className="italic">{children}</em>,
        code: ({ children }) => (
          <code className="rounded bg-black/[0.06] px-1 py-0.5 font-mono text-[0.95em]">
            {children}
          </code>
        ),
      }}
    >
      {text}
    </ReactMarkdown>
  );
}

function toUiMessages(messages: PersistedMessage[]): UIMessage[] {
  return messages.map((m) => ({
    id: m.id,
    role: m.role,
    parts: [{ type: "text", text: m.content, state: "done" }],
  }));
}

function UserBubble() {
  return (
    <MessagePrimitive.Root className="mb-3 flex justify-end last:mb-0">
      <div className="max-w-[92%] rounded-2xl border border-[color:rgba(97,106,243,0.18)] bg-[color:rgba(97,106,243,0.10)] px-4 py-2.5 text-[15px] leading-relaxed text-[color:rgba(11,18,32,0.92)] md:max-w-3xl">
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
    <MessagePrimitive.Root className="mb-3 flex justify-start last:mb-0">
      <div className="max-w-[92%] rounded-2xl border border-[color:rgba(15,23,42,0.10)] bg-white px-4 py-2.5 text-[15px] leading-relaxed text-[color:rgba(11,18,32,0.90)] md:max-w-3xl">
        <MessagePrimitive.Parts
          components={{
            Text: (props) => <MarkdownText text={(props as any).text ?? ""} />,
            Reasoning: () => null,
          }}
        />
      </div>
    </MessagePrimitive.Root>
  );
}

function Composer() {
  const api = useAssistantApi();
  const attachmentsCount = useAssistantState((s) => s.composer.attachments.length);
  const isRunning = useAssistantState((s) => s.thread.isRunning);
  const [pickerOpen, setPickerOpen] = useState(false);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function addFiles(files: FileList | null) {
    const arr = Array.from(files ?? []);
    if (!arr.length) return;
    for (const f of arr) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await api.composer().addAttachment(f);
      } catch {
        // ignore
      }
    }
  }

  return (
    <>
      {pickerOpen && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setPickerOpen(false)}
            className="absolute inset-0 bg-black/30"
          />
          <div className="absolute bottom-0 left-0 right-0 rounded-t-3xl bg-[color:var(--card)] shadow-[0_-18px_48px_rgba(15,23,42,0.18)]">
            <div className="mx-auto w-full max-w-md p-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-semibold text-[color:rgba(11,18,32,0.90)]">
                  Add to chat
                </div>
                <button
                  type="button"
                  onClick={() => setPickerOpen(false)}
                  className="h-9 w-9 rounded-xl border border-[color:rgba(15,23,42,0.12)] bg-white/85 text-[color:rgba(11,18,32,0.72)]"
                >
                  ×
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setPickerOpen(false);
                    imageInputRef.current?.click();
                  }}
                  className="rounded-2xl border border-[color:rgba(15,23,42,0.10)] bg-white/90 p-4 text-left hover:bg-white"
                >
                  <div className="text-sm font-semibold text-[color:rgba(11,18,32,0.90)]">
                    Add photo
                  </div>
                  <div className="mt-1 text-[12px] text-[color:rgba(11,18,32,0.62)]">
                    PNG, JPG, WEBP
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPickerOpen(false);
                    fileInputRef.current?.click();
                  }}
                  className="rounded-2xl border border-[color:rgba(15,23,42,0.10)] bg-white/90 p-4 text-left hover:bg-white"
                >
                  <div className="text-sm font-semibold text-[color:rgba(11,18,32,0.90)]">
                    Add file
                  </div>
                  <div className="mt-1 text-[12px] text-[color:rgba(11,18,32,0.62)]">
                    PDF, DOC, etc.
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => void addFiles(e.target.files)}
      />
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => void addFiles(e.target.files)}
      />

      <ComposerPrimitive.Root className="rounded-3xl border border-[color:rgba(15,23,42,0.12)] bg-white/95 px-2 py-2 shadow-[0_14px_40px_rgba(15,23,42,0.10)]">
        {attachmentsCount > 0 && (
          <div className="px-2 pt-2">
            <div className="flex flex-wrap gap-2">
              <ComposerPrimitive.Attachments
                components={{
                  Attachment: () => {
                    const name = useAssistantState((s) => s.attachment?.name ?? "Attachment");
                    return (
                      <div className="inline-flex items-center gap-2 rounded-full border border-[color:rgba(15,23,42,0.10)] bg-white/90 px-3 py-1.5 text-[12px] text-[color:rgba(11,18,32,0.82)]">
                        <span className="max-w-[190px] truncate">{name}</span>
                      </div>
                    );
                  },
                }}
              />
            </div>
          </div>
        )}

        <div className="flex items-end gap-2 px-2 py-2">
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:rgba(15,23,42,0.12)] bg-white/90 text-[18px] font-semibold text-[color:rgba(11,18,32,0.78)] hover:bg-white disabled:opacity-60"
            disabled={isRunning}
            aria-label="Add attachment"
          >
            +
          </button>

          <ComposerPrimitive.Input
            submitOnEnter
            className="min-h-[44px] flex-1 resize-none rounded-2xl bg-transparent px-2 py-2 text-[16px] leading-relaxed text-[color:rgba(11,18,32,0.92)] outline-none placeholder:text-[color:rgba(11,18,32,0.45)] focus:shadow-[0_0_0_4px_rgba(97,106,243,0.14)]"
            placeholder="Message…"
          />

          <ComposerPrimitive.Send
            aria-label="Send"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[color:rgba(15,23,42,0.92)] text-[18px] font-semibold text-white shadow-[0_10px_22px_rgba(15,23,42,0.18)] hover:bg-[color:rgba(15,23,42,0.84)]"
          >
            ↑
          </ComposerPrimitive.Send>
        </div>

        <ComposerPrimitive.Cancel className="hidden" />
      </ComposerPrimitive.Root>
    </>
  );
}

function ChatThread() {
  return (
    <ThreadPrimitive.Root className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <ThreadPrimitive.Viewport className="min-h-0 flex-1 overflow-y-auto rounded-3xl border border-[color:rgba(15,23,42,0.10)] bg-[color:rgba(15,23,42,0.02)] px-5 py-6 md:px-6">
        <ThreadPrimitive.Messages
          components={{
            UserMessage: UserBubble,
            AssistantMessage: AssistantBubble,
          }}
        />
      </ThreadPrimitive.Viewport>

      <div className="sticky bottom-0 mt-3 bg-[color:var(--card)] pt-2 pb-[calc(env(safe-area-inset-bottom)+8px)]">
        <Composer />
      </div>
    </ThreadPrimitive.Root>
  );
}

function ChatWorkspace({
  chatId,
  initialMessages,
  model,
  mentorId,
  onSelectMentor,
  drawerOpen,
  setDrawerOpen,
}: {
  chatId: string;
  initialMessages: UIMessage[];
  model: string;
  mentorId: MentorId;
  onSelectMentor: (id: MentorId) => void;
  drawerOpen: boolean;
  setDrawerOpen: (v: boolean) => void;
}) {
  const transport = useMemo(
    () =>
      new AssistantChatTransport({
        api: "/api/chat",
        body: { chatId, model, mentorId },
        fetch: async (input, init) => {
          const url = typeof input === "string" ? input : input instanceof Request ? input.url : "";
          const res = await fetch(input as any, init as any);
          if (url.includes("/api/chat") && !res.ok) {
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
                  mentorId,
                },
                timestamp: Date.now(),
              }),
            }).catch(() => {});
          }
          return res;
        },
      }),
    [chatId, model, mentorId],
  );

  const runtime = useChatRuntime({
    transport,
    messages: initialMessages,
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
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
                <MentorsNav
                  activeMentorId={mentorId}
                  onSelectMentor={onSelectMentor}
                  onNavigate={() => setDrawerOpen(false)}
                />
                <ChatList onNavigate={() => setDrawerOpen(false)} />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1 gap-4">
        <aside className="hidden min-h-0 w-72 shrink-0 overflow-hidden md:block">
          <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-[color:rgba(15,23,42,0.10)] bg-[color:rgba(255,255,255,0.85)] p-4 shadow-[var(--shadow-sm)]">
            <Link href="/app" className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-2xl bg-gradient-to-br from-[color:var(--accent)] to-[color:var(--accent-2)] shadow-[0_16px_34px_rgba(97,106,243,0.18)]" />
              <div>
                <div className="text-sm font-semibold leading-4">WebMorpher</div>
                <div className="text-[11px] text-[color:rgba(11,18,32,0.60)]">
                  AI mentors for business
                </div>
              </div>
            </Link>

            <div className="mt-2 min-h-0 flex-1 overflow-y-auto pr-1">
              <MentorsNav activeMentorId={mentorId} onSelectMentor={onSelectMentor} />
              <ChatList />
            </div>
          </div>
        </aside>

        <div className="flex min-h-0 flex-1 flex-col">
          <ChatThread />
        </div>
      </div>
    </AssistantRuntimeProvider>
  );
}

export default function AppClient({ chatId }: { chatId: string | null }) {
  const activeChatId = typeof chatId === "string" && chatId.trim() ? chatId : "";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [persisted, setPersisted] = useState<PersistedMessage[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mentorId, setMentorId] = useState<MentorId>("general");
  const [profileOpen, setProfileOpen] = useState(false);

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
    Promise.all([
      fetch(`/api/chats/${encodeURIComponent(activeChatId)}`),
      fetch(`/api/chats/${encodeURIComponent(activeChatId)}/messages`),
    ])
      .then(async ([metaRes, msgRes]) => {
        if (!metaRes.ok) {
          const t = await metaRes.text().catch(() => "");
          throw new Error(`Failed to load chat meta: HTTP ${metaRes.status} ${t}`);
        }
        if (!msgRes.ok) {
          const t = await msgRes.text().catch(() => "");
          throw new Error(`Failed to load messages: HTTP ${msgRes.status} ${t}`);
        }
        const meta = await metaRes.json().catch(() => ({} as any));
        const messagesJson = await msgRes.json().catch(() => ({} as any));
        return { meta, messagesJson };
      })
      .then(async (r) => {
        const { meta, messagesJson } = r as any;
        if (cancelled) return;
        const mId = typeof meta?.mentorId === "string" ? meta.mentorId.trim() : "general";
        setMentorId(isMentorId(mId) ? (mId as MentorId) : "general");

        const msgs = Array.isArray(messagesJson?.messages)
          ? (messagesJson.messages as PersistedMessage[])
          : [];
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

  async function selectMentor(next: MentorId) {
    setMentorId(next);
    if (!activeChatId) return;
    await fetch(`/api/chats/${encodeURIComponent(activeChatId)}`, {
      method: "PATCH",
        headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mentorId: next }),
    }).catch(() => {});
  }

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--card)] p-4 shadow-[var(--shadow)]">
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
          <div className="relative">
            <button
              type="button"
              onClick={() => setProfileOpen((v) => !v)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[color:rgba(15,23,42,0.12)] bg-white/85 text-[12px] font-semibold text-[color:rgba(11,18,32,0.84)] hover:bg-white"
              aria-label="Open profile menu"
            >
              ☺
            </button>
            {profileOpen && (
              <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-44 overflow-hidden rounded-2xl border border-[color:rgba(15,23,42,0.12)] bg-white shadow-[0_18px_48px_rgba(2,6,23,0.18)]">
                <Link
                  href="/app/account"
                  className="block px-3 py-2 text-[12px] font-semibold text-[color:rgba(11,18,32,0.86)] hover:bg-[color:rgba(15,23,42,0.04)]"
                  onClick={() => setProfileOpen(false)}
                >
                  Account
                </Link>
                <Link
                  href="/app/billing"
                  className="block px-3 py-2 text-[12px] font-semibold text-[color:rgba(11,18,32,0.86)] hover:bg-[color:rgba(15,23,42,0.04)]"
                  onClick={() => setProfileOpen(false)}
                >
                  Billing
                </Link>
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="block w-full px-3 py-2 text-left text-[12px] font-semibold text-[color:rgba(185,28,28,0.92)] hover:bg-[color:rgba(239,68,68,0.08)]"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
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
            <ChatWorkspace
              key={`${activeChatId}:${model}:${mentorId}:${initialMessages.length}`}
              chatId={activeChatId}
              initialMessages={initialMessages}
              model={model}
              mentorId={mentorId}
              onSelectMentor={selectMentor}
              drawerOpen={drawerOpen}
              setDrawerOpen={setDrawerOpen}
            />
          )}
        </div>
      )}
    </div>
  );
}


