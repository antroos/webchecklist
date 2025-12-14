"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type ChatListItem = {
  id: string;
  title?: string;
  lastMessagePreview?: string | null;
};

export default function ChatList() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeChatId = searchParams?.get("chatId") || "";
  const [items, setItems] = useState<ChatListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const basePath = useMemo(() => {
    // Keep list visible only under /app routes.
    return pathname?.startsWith("/app") ? "/app" : "/app";
  }, [pathname]);

  async function refresh() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/chats");
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`Failed to load chats: HTTP ${res.status} ${t}`);
      }
      const data = (await res.json()) as { chats?: any[] };
      const chats = Array.isArray(data.chats) ? data.chats : [];
      setItems(
        chats.map((c) => ({
          id: String(c.id),
          title: typeof c.title === "string" ? c.title : "Chat",
          lastMessagePreview: typeof c.lastMessagePreview === "string" ? c.lastMessagePreview : null,
        })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load chats");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function newChat() {
    setError(null);
    setCreating(true);
    try {
      const res = await fetch("/api/chats", { method: "POST", headers: { "Content-Type": "application/json" } });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`Failed to create chat: HTTP ${res.status} ${t}`);
      }
      const data = (await res.json()) as { chatId?: string };
      if (!data.chatId) throw new Error("Missing chatId");
      await refresh();
      router.push(`${basePath}?chatId=${encodeURIComponent(data.chatId)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create chat");
    } finally {
      setCreating(false);
    }
  }

  async function renameChat(chatId: string) {
    const current = items.find((x) => x.id === chatId)?.title || "Chat";
    const next = window.prompt("Rename chat", current);
    if (!next || !next.trim()) return;
    setError(null);
    try {
      const res = await fetch(`/api/chats/${encodeURIComponent(chatId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: next.trim() }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`Rename failed: HTTP ${res.status} ${t}`);
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rename failed");
    } finally {
      setMenuFor(null);
    }
  }

  async function deleteChatById(chatId: string) {
    const ok = window.confirm(
      "Delete this chat forever? This action cannot be undone.",
    );
    if (!ok) return;
    setError(null);
    try {
      const res = await fetch(`/api/chats/${encodeURIComponent(chatId)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`Delete failed: HTTP ${res.status} ${t}`);
      }
      await refresh();
      if (activeChatId && activeChatId === chatId) {
        router.push(basePath);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setMenuFor(null);
    }
  }

  function openChat(chatId: string) {
    router.push(`${basePath}?chatId=${encodeURIComponent(chatId)}`);
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-[color:rgba(11,18,32,0.60)]">
          Chats
        </div>
        <button
          type="button"
          onClick={newChat}
          disabled={creating}
          className="h-7 rounded-lg border border-[color:rgba(15,23,42,0.12)] bg-[color:rgba(255,255,255,0.85)] px-2 text-[11px] font-semibold text-[color:rgba(11,18,32,0.84)] hover:bg-[color:rgba(255,255,255,0.95)] disabled:opacity-60"
        >
          {creating ? "…" : "New"}
        </button>
      </div>

      {error && (
        <div className="mt-2 rounded-lg border border-[color:rgba(239,68,68,0.25)] bg-[color:rgba(239,68,68,0.08)] px-2 py-1 text-[11px] text-[color:rgba(185,28,28,0.95)]">
          {error}
        </div>
      )}

      <div className="mt-2 space-y-1">
        {loading && items.length === 0 && (
          <div className="rounded-lg border border-[color:rgba(15,23,42,0.10)] bg-[color:rgba(15,23,42,0.02)] px-2 py-2 text-[11px] text-[color:rgba(11,18,32,0.62)]">
            Loading…
          </div>
        )}
        {items.map((c) => {
          const active = activeChatId && c.id === activeChatId;
          return (
            <div
              key={c.id}
              className={[
                "relative w-full rounded-xl px-2 py-2 text-left transition",
                active
                  ? "border border-[color:rgba(97,106,243,0.24)] bg-[color:rgba(97,106,243,0.10)]"
                  : "border border-transparent hover:bg-[color:rgba(15,23,42,0.04)]",
              ].join(" ")}
            >
              <button
                type="button"
                onClick={() => openChat(c.id)}
                className="block w-full pr-8 text-left"
              >
                <div className="truncate text-[12px] font-semibold text-[color:rgba(11,18,32,0.86)]">
                  {c.title || "Chat"}
                </div>
                {c.lastMessagePreview && (
                  <div className="mt-0.5 truncate text-[11px] text-[color:rgba(11,18,32,0.62)]">
                    {c.lastMessagePreview}
                  </div>
                )}
              </button>

              <button
                type="button"
                onClick={() => setMenuFor((prev) => (prev === c.id ? null : c.id))}
                className="absolute right-1 top-1 rounded-lg px-2 py-1 text-[12px] text-[color:rgba(11,18,32,0.55)] hover:bg-[color:rgba(255,255,255,0.70)]"
                aria-label="Chat menu"
              >
                …
              </button>

              {menuFor === c.id && (
                <div className="absolute right-1 top-8 z-10 w-44 overflow-hidden rounded-xl border border-[color:rgba(15,23,42,0.12)] bg-[color:rgba(255,255,255,0.98)] shadow-[var(--shadow)]">
                  <button
                    type="button"
                    onClick={() => renameChat(c.id)}
                    className="block w-full px-3 py-2 text-left text-[12px] text-[color:rgba(11,18,32,0.88)] hover:bg-[color:rgba(15,23,42,0.04)]"
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteChatById(c.id)}
                    className="block w-full px-3 py-2 text-left text-[12px] text-[color:rgba(185,28,28,0.95)] hover:bg-[color:rgba(239,68,68,0.08)]"
                  >
                    Delete…
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}


