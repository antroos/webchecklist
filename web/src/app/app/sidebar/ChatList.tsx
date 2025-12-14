"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type ChatListItem = {
  id: string;
  title?: string;
  lastMessagePreview?: string | null;
};

export default function ChatList() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const activeChatId = searchParams?.get("chatId") || "";
  const [items, setItems] = useState<ChatListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ChatList lives under /app layout; keep navigation stable.
  const basePath = "/app";

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
      return chats.map((c) => ({ id: String(c.id) }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load chats");
      return null;
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
    const next = renameDraft.trim();
    if (!next) return;
    setError(null);
    try {
      const res = await fetch(`/api/chats/${encodeURIComponent(chatId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: next }),
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
      setRenamingId(null);
    }
  }

  async function deleteChatById(chatId: string) {
    setError(null);
    setDeletingId(chatId);
    try {
      const res = await fetch(`/api/chats/${encodeURIComponent(chatId)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`Delete failed: HTTP ${res.status} ${t}`);
      }
      const next = await refresh();
      if (activeChatId && activeChatId === chatId) {
        const first = Array.isArray(next) && next.length > 0 ? next[0] : null;
        if (first?.id) router.push(`${basePath}?chatId=${encodeURIComponent(first.id)}`);
        else router.push(basePath);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setMenuFor(null);
      setConfirmDeleteId(null);
      setDeletingId(null);
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
          const isRenaming = renamingId === c.id;
          const isConfirmingDelete = confirmDeleteId === c.id;
          const isDeleting = deletingId === c.id;
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
              {!isRenaming ? (
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
              ) : (
                <div className="pr-8">
                  <input
                    autoFocus
                    value={renameDraft}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void renameChat(c.id);
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        setRenamingId(null);
                        setMenuFor(null);
                      }
                    }}
                    className="h-8 w-full rounded-lg border border-[color:rgba(15,23,42,0.12)] bg-[color:rgba(255,255,255,0.95)] px-2 text-[12px] text-[color:rgba(11,18,32,0.88)] outline-none focus:border-[color:rgba(97,106,243,0.55)] focus:shadow-[0_0_0_3px_rgba(97,106,243,0.14)]"
                    placeholder="Chat title"
                  />
                  <div className="mt-1 flex gap-2">
                    <button
                      type="button"
                      onClick={() => void renameChat(c.id)}
                      disabled={!renameDraft.trim()}
                      className="h-7 rounded-lg bg-[color:rgba(97,106,243,0.16)] px-2 text-[11px] font-semibold text-[color:rgba(11,18,32,0.86)] hover:bg-[color:rgba(97,106,243,0.22)] disabled:opacity-60"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRenamingId(null);
                        setMenuFor(null);
                      }}
                      className="h-7 rounded-lg border border-[color:rgba(15,23,42,0.12)] bg-white/80 px-2 text-[11px] font-semibold text-[color:rgba(11,18,32,0.80)] hover:bg-white"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

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
                    onClick={() => {
                      setRenameDraft(items.find((x) => x.id === c.id)?.title || "Chat");
                      setRenamingId(c.id);
                      setConfirmDeleteId(null);
                      setMenuFor(null);
                    }}
                    className="block w-full px-3 py-2 text-left text-[12px] text-[color:rgba(11,18,32,0.88)] hover:bg-[color:rgba(15,23,42,0.04)]"
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmDeleteId(c.id);
                      setRenamingId(null);
                      setMenuFor(null);
                    }}
                    className="block w-full px-3 py-2 text-left text-[12px] text-[color:rgba(185,28,28,0.95)] hover:bg-[color:rgba(239,68,68,0.08)]"
                  >
                    Delete…
                  </button>
                </div>
              )}

              {isConfirmingDelete && (
                <div className="mt-2 rounded-xl border border-[color:rgba(239,68,68,0.22)] bg-[color:rgba(255,255,255,0.90)] p-2">
                  <div className="text-[12px] leading-snug text-[color:rgba(11,18,32,0.82)]">
                    Delete this chat forever? This cannot be undone.
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={() => void deleteChatById(c.id)}
                      className="h-7 flex-1 rounded-lg bg-[color:rgba(239,68,68,0.14)] px-2 text-[11px] font-semibold text-[color:rgba(185,28,28,0.95)] hover:bg-[color:rgba(239,68,68,0.18)] disabled:opacity-60"
                    >
                      {isDeleting ? "Deleting…" : "Delete"}
                    </button>
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={() => setConfirmDeleteId(null)}
                      className="h-7 flex-1 rounded-lg border border-[color:rgba(15,23,42,0.12)] bg-white/80 px-2 text-[11px] font-semibold text-[color:rgba(11,18,32,0.80)] hover:bg-white disabled:opacity-60"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}


