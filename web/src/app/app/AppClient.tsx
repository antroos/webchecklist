"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

import SidebarNav from "./sidebar/SidebarNav";
import ChatList from "./sidebar/ChatList";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  kind?: "status" | "result" | "plain";
  mode?: "qa_checklist" | "uiux_audit";
  csv?: string;
  markdown?: string;
  raw?: unknown;
  html?: string;
  reportText?: string; // human-friendly rendering for in-app report (derived from csv)
  snapshotId?: string;
  analysisId?: string;
};

type AnalysisMode = "qa_checklist" | "uiux_audit";

// SSE event types from /api/analyses
type SSEEvent =
  | { type: "log"; message: string }
  | {
      type: "result";
      analysisId: string;
      snapshotId: string;
      mode: AnalysisMode;
      url: string;
      output:
        | { kind: "csv"; csv: string }
        | { kind: "markdown"; markdown: string };
    }
  | { type: "error"; message: string };

type OverageCapPayload = {
  error: "OVERAGE_CAP";
  overageLimitCents: number;
  projectedOverageCents: number;
  overageUnitPriceCents: number;
  overageUnitsRequested: number;
  unlocked: boolean;
};

type BillingStatusMini = {
  plan: "starter" | "pro" | null;
  includedMonthlyLimit: number;
  periodIncludedUsed: number;
  includedRemaining: number;
};

function centsToDollars(cents: number) {
  return Math.round(cents) / 100;
}

const SNAPSHOT_COMMAND = "<make a snapshot>";

function normalizeUrlCandidate(text: string): string {
  const t = (text || "").trim();
  if (!t) return "";
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

function parseCsvChecklistToText(csv: string): { title: string; items: string[]; text: string } {
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return { title: "QA checklist", items: [], text: "" };

  function parseFirstCsvField(line: string): string {
    const s = (line || "").trim();
    if (!s) return "";

    // Quoted CSV field: "a, b" (supports escaped quotes: "")
    if (s.startsWith("\"")) {
      let out = "";
      let i = 1;
      while (i < s.length) {
        const ch = s[i];
        if (ch === "\"") {
          if (s[i + 1] === "\"") {
            out += "\"";
            i += 2;
            continue;
          }
          break; // closing quote
        }
        out += ch;
        i += 1;
      }
      return out.trim();
    }

    // Unquoted field: read until first comma.
    const comma = s.indexOf(",");
    const field = comma === -1 ? s : s.slice(0, comma);
    return field.trim().replace(/^"|"$/g, "");
  }

  // Skip header if present (first column == "check")
  const firstField = parseFirstCsvField(lines[0]).toLowerCase().replace(/^\uFEFF/, "");
  const start = firstField === "check" ? 1 : 0;

  const checks: string[] = [];
  for (const line of lines.slice(start)) {
    const check = parseFirstCsvField(line);
    if (check) checks.push(check);
  }

  const text = checks.map((c) => `- ${c}`).join("\n");
  return { title: "QA checklist", items: checks, text };
}

export default function AppClient({ chatId }: { chatId: string | null }) {
  const router = useRouter();
  const [credits, setCredits] = useState<number | null>(null);
  const [billing, setBilling] = useState<BillingStatusMini | null>(null);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [urlInput, setUrlInput] = useState("");
  const [promptInput, setPromptInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [abortController, setAbortController] =
    useState<AbortController | null>(null);
  const [needsUpgrade, setNeedsUpgrade] = useState(false);
  const [overagePrompt, setOveragePrompt] = useState<OverageCapPayload | null>(null);
  const [activeSnapshot, setActiveSnapshot] = useState<{
    snapshotId: string;
    url: string;
    title: string | null;
  } | null>(null);
  const [selectedMode, setSelectedMode] = useState<AnalysisMode>("qa_checklist");
  const [pendingAnalysis, setPendingAnalysis] = useState<{
    snapshotId: string;
    mode: AnalysisMode;
    instruction: string;
  } | null>(null);
  const [creatingChat, setCreatingChat] = useState(false);

  const requestId = useMemo(() => {
    // One id per page load; used for idempotent credit reservation server-side.
    return typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `rid-${Date.now()}-${Math.random()}`;
  }, []);

  const wmdbg = useMemo(() => {
    const endpoint =
      "http://127.0.0.1:7242/ingest/e38c11ec-9fba-420e-88d7-64588137f26f";
    return (hypothesisId: string, location: string, message: string, data: unknown) => {
      if (typeof window === "undefined") return;
      const host = window.location.hostname;
      if (host !== "localhost" && host !== "127.0.0.1") return;
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "debug-session",
          runId: "run1",
          hypothesisId,
          location,
          message,
          data,
          timestamp: Date.now(),
        }),
      }).catch(() => {});
    };
  }, []);

  async function persistMessage(params: {
    chatId: string;
    role: "user" | "assistant";
    kind: "status" | "result" | "plain";
    content: string;
    artifacts?: {
      csv?: string;
      markdown?: string;
      raw?: unknown;
      html?: string;
      snapshotId?: string;
      analysisId?: string;
      mode?: string;
    };
  }) {
    try {
      // #region agent log
      wmdbg("H-C", "web/src/app/app/AppClient.tsx:persistMessage", "persistMessage.call", {
        chatIdTail: String(params.chatId).slice(-6),
        role: params.role,
        kind: params.kind,
        contentLen: params.content?.length ?? 0,
        hasArtifacts: Boolean(params.artifacts),
      });
      // #endregion agent log

      await fetch(`/api/chats/${encodeURIComponent(params.chatId)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: params.role,
          kind: params.kind,
          content: params.content,
          artifacts: params.artifacts,
        }),
      });
    } catch {
      // ignore (MVP: keep UX working even if persistence fails)
    }
  }

  async function loadChat(chatId: string) {
    try {
      const res = await fetch(`/api/chats/${encodeURIComponent(chatId)}/messages`);
      // #region agent log
      wmdbg("H-B", "web/src/app/app/AppClient.tsx:loadChat", "loadChat.response", {
        chatIdTail: String(chatId).slice(-6),
        ok: res.ok,
        status: res.status,
      });
      // #endregion agent log
      if (!res.ok) return false;
      const data = (await res.json()) as { messages?: any[] };
      const list = Array.isArray(data.messages) ? data.messages : [];
      setMessages(
        list.map((m) => ({
          id: String(m.id ?? `m-${Math.random()}`),
          role: m.role === "user" ? "user" : "assistant",
          kind: m.kind === "status" || m.kind === "result" || m.kind === "plain" ? m.kind : "plain",
          content: typeof m.content === "string" ? m.content : "",
          mode:
            m.artifacts?.mode === "qa_checklist" || m.artifacts?.mode === "uiux_audit"
              ? (m.artifacts.mode as AnalysisMode)
              : undefined,
          csv: typeof m.artifacts?.csv === "string" ? m.artifacts.csv : undefined,
          markdown: typeof m.artifacts?.markdown === "string" ? m.artifacts.markdown : undefined,
          raw: typeof m.artifacts?.raw !== "undefined" ? m.artifacts.raw : undefined,
          html: typeof m.artifacts?.html === "string" ? m.artifacts.html : undefined,
          snapshotId: typeof m.artifacts?.snapshotId === "string" ? m.artifacts.snapshotId : undefined,
          analysisId: typeof m.artifacts?.analysisId === "string" ? m.artifacts.analysisId : undefined,
        })),
      );
      return true;
    } catch {
      return false;
    }
  }

  async function refreshHeaderStats() {
    try {
      const [meRes, billingRes] = await Promise.all([
        fetch("/api/me"),
        fetch("/api/billing/status"),
      ]);

      if (meRes.ok) {
        const data = (await meRes.json()) as { freeCreditsRemaining?: number };
        if (typeof data.freeCreditsRemaining === "number") {
          setCredits(data.freeCreditsRemaining);
        }
      }

      if (billingRes.ok) {
        const data = (await billingRes.json()) as Partial<BillingStatusMini>;
        setBilling({
          plan: data.plan === "starter" || data.plan === "pro" ? data.plan : null,
          includedMonthlyLimit:
            typeof data.includedMonthlyLimit === "number" ? data.includedMonthlyLimit : 0,
          periodIncludedUsed:
            typeof data.periodIncludedUsed === "number" ? data.periodIncludedUsed : 0,
          includedRemaining:
            typeof data.includedRemaining === "number" ? data.includedRemaining : 0,
        });
      } else {
        // If user has no billing status yet (or endpoint fails), keep UI safe.
        setBilling(null);
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    void refreshHeaderStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Client-side safety: if server redirect didn't happen (or got skipped), open the most recent chat.
    if (chatId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/chats");
        if (!res.ok) return;
        const data = (await res.json()) as { chats?: any[] };
        const chats = Array.isArray(data.chats) ? data.chats : [];
        const first = chats[0];
        const id = typeof first?.id === "string" ? first.id : "";
        if (!id) return;
        if (!cancelled) {
          router.replace(`/app?chatId=${encodeURIComponent(id)}`);
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chatId, router]);

  useEffect(() => {
    let cancelled = false;

    async function ensure() {
      // #region agent log
      wmdbg("H-A", "web/src/app/app/AppClient.tsx:ensure", "ensure.entry", {
        propChatId: chatId,
        propChatIdTail: chatId ? String(chatId).slice(-6) : null,
      });
      // #endregion agent log

      if (!chatId) {
        setActiveChatId(null);
        // #region agent log
        // New chats should be created only via explicit user action ("New" button).
        wmdbg("H-A", "web/src/app/app/AppClient.tsx:ensure", "ensure.noChatId.noAutoCreate", {});
        // #endregion agent log
        return;
      }

      setActiveChatId(chatId);
      const ok = await loadChat(chatId);
      if (!ok) {
        // Fallback: if chat does not exist (or access denied), create a new one.
        try {
          // #region agent log
          wmdbg("H-B", "web/src/app/app/AppClient.tsx:ensure", "ensure.createChat.loadChatFailed", {
            chatIdTail: String(chatId).slice(-6),
          });
          // #endregion agent log
          const res = await fetch("/api/chats", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          });
          if (!res.ok) return;
          const data = (await res.json()) as { chatId?: string };
          if (!data.chatId) return;
          if (!cancelled) {
            router.replace(`/app?chatId=${encodeURIComponent(data.chatId)}`);
          }
        } catch {
          // ignore
        }
      }
    }

    void ensure();

    return () => {
      cancelled = true;
    };
  }, [chatId, router]);

  async function createChatFromWorkspace() {
    if (creatingChat) return;
    setError(null);
    setCreatingChat(true);
    try {
      const res = await fetch("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`Failed to create chat: HTTP ${res.status} ${t}`);
      }
      const data = (await res.json()) as { chatId?: string };
      const id = typeof data.chatId === "string" ? data.chatId : "";
      if (!id) throw new Error("Missing chatId");
      router.replace(`/app?chatId=${encodeURIComponent(id)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create chat");
    } finally {
      setCreatingChat(false);
    }
  }

  async function createSnapshotFromUrl(url: string) {
    const res = await fetch("/api/snapshots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`Snapshot failed: HTTP ${res.status} ${res.statusText}${t ? ` — ${t}` : ""}`);
    }
    const data = (await res.json().catch(() => null)) as
      | { ok?: boolean; snapshotId?: string; url?: string; title?: string | null }
      | null;
    const snapshotId = typeof data?.snapshotId === "string" ? data.snapshotId : "";
    const normalizedUrl = typeof data?.url === "string" ? data.url : url;
    const title = typeof data?.title === "string" ? data.title : null;
    if (!snapshotId) throw new Error("Snapshot failed: missing snapshotId");
    return { snapshotId, url: normalizedUrl, title };
  }

  async function runAnalysis(params: { snapshotId: string; mode: AnalysisMode; instruction: string }) {
    const controller = new AbortController();
    setAbortController(controller);

    const res = await fetch("/api/analyses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshotId: params.snapshotId,
        mode: params.mode,
        instruction: params.instruction,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      if (res.status === 409) {
        const data = (await res.json().catch(() => null)) as OverageCapPayload | null;
        if (data && data.error === "OVERAGE_CAP") {
          setOveragePrompt(data);
          setPendingAnalysis(params);
          return;
        }
      }
      const text = await res.text().catch(() => "");
      if (res.status === 402) setNeedsUpgrade(true);
      throw new Error(`HTTP ${res.status}: ${res.statusText}${text ? ` — ${text}` : ""}`);
    }

    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    if (!reader) throw new Error("No response body");

    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim() || !line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6);
        try {
          const event = JSON.parse(jsonStr) as SSEEvent;
          if (event.type === "log") {
            const msg: ChatMessage = {
              id: `log-${Date.now()}-${Math.random()}`,
              role: "assistant",
              kind: "status",
              content: event.message,
            };
            setMessages((prev) => [...prev, msg]);
            if (activeChatId) {
              void persistMessage({
                chatId: activeChatId,
                role: "assistant",
                kind: "status",
                content: msg.content,
              });
            }
          } else if (event.type === "result") {
            void refreshHeaderStats();
            let csv: string | undefined;
            let markdown: string | undefined;
            if (event.output?.kind === "csv") csv = event.output.csv;
            else if (event.output?.kind === "markdown") markdown = event.output.markdown;
            const msg: ChatMessage = {
              id: `result-${Date.now()}`,
              role: "assistant",
              kind: "result",
              mode: event.mode,
              content:
                event.mode === "qa_checklist"
                  ? `QA checklist for ${event.url}`
                  : `UI/UX audit for ${event.url}`,
              csv,
              markdown,
              snapshotId: event.snapshotId,
              analysisId: event.analysisId,
            };
            setMessages((prev) => [...prev, msg]);
            if (activeChatId) {
              void persistMessage({
                chatId: activeChatId,
                role: "assistant",
                kind: "result",
                content: msg.content,
                artifacts: {
                  csv: msg.csv,
                  markdown: msg.markdown,
                  snapshotId: msg.snapshotId,
                  analysisId: msg.analysisId,
                  mode: msg.mode,
                },
              });
            }
          } else if (event.type === "error") {
            setError(event.message);
            void refreshHeaderStats();
            const msg: ChatMessage = {
              id: `err-${Date.now()}`,
              role: "assistant",
              kind: "plain",
              content: event.message,
            };
            setMessages((prev) => [...prev, msg]);
            if (activeChatId) {
              void persistMessage({
                chatId: activeChatId,
                role: "assistant",
                kind: "plain",
                content: msg.content,
              });
            }
          }
        } catch (parseErr) {
          console.warn("Failed to parse SSE event:", line, parseErr);
        }
      }
    }
  }

  async function handleMakeSnapshot() {
    if (isLoading) return;
    if (!activeChatId) {
      setError("Create a chat first, then paste a URL and click Make snapshot.");
      return;
    }
    const url = normalizeUrlCandidate(urlInput);
    if (!url) {
      setError("Paste a URL first.");
      return;
    }

    setError(null);
    setNeedsUpgrade(false);
    setOveragePrompt(null);
    setPendingAnalysis(null);
    setIsLoading(true);

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      kind: "plain",
      content: url,
    };
    setMessages((prev) => [...prev, userMessage]);
    void persistMessage({
      chatId: activeChatId,
      role: "user",
      kind: "plain",
      content: userMessage.content,
    });

    try {
      const snap = await createSnapshotFromUrl(url);
      setActiveSnapshot({ snapshotId: snap.snapshotId, url: snap.url, title: snap.title });

      const msg: ChatMessage = {
        id: `snapshot-${Date.now()}`,
        role: "assistant",
        kind: "plain",
        content: `Snapshot ready for ${snap.url}`,
        snapshotId: snap.snapshotId,
      };
      setMessages((prev) => [...prev, msg]);
      void persistMessage({
        chatId: activeChatId,
        role: "assistant",
        kind: "plain",
        content: msg.content,
        artifacts: { snapshotId: snap.snapshotId },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Snapshot failed";
      setError(message);
      setMessages((prev) => [
        ...prev,
        { id: `err-${Date.now()}`, role: "assistant", kind: "plain", content: message },
      ]);
    } finally {
      setAbortController(null);
      setIsLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isLoading) return;
    if (!activeChatId) {
      setError("Create a chat first.");
      return;
    }

    setError(null);
    setNeedsUpgrade(false);
    setOveragePrompt(null);
    setPendingAnalysis(null);

    const text = (promptInput || "").trim();
    if (!text) return;

    if (text === SNAPSHOT_COMMAND) {
      setPromptInput("");
      await handleMakeSnapshot();
      return;
    }

    if (!activeSnapshot?.snapshotId) {
      setError("Make a snapshot first (paste a URL and click Make snapshot).");
      return;
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      kind: "plain",
      content: text,
    };

    setMessages((prev) => [...prev, userMessage]);
    setPromptInput("");
    setIsLoading(true);

    void persistMessage({
      chatId: activeChatId,
      role: "user",
      kind: "plain",
      content: userMessage.content,
    });

    try {
      await runAnalysis({
        snapshotId: activeSnapshot.snapshotId,
        mode: selectedMode,
        instruction: userMessage.content,
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        const message = "⏹️ Processing stopped by user.";
        setMessages((prev) => [
          ...prev,
          {
            id: `stopped-${Date.now()}`,
            role: "assistant",
            kind: "plain",
            content: message,
          },
        ]);
      } else {
        const message =
          err instanceof Error
            ? err.message
            : "Network error while processing the request.";
        setError(message);
        void refreshHeaderStats();
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: "assistant",
            kind: "plain",
            content: message,
          },
        ]);
      }
    } finally {
      setAbortController(null);
      setIsLoading(false);
    }
  }

  function handleStop() {
    abortController?.abort();
  }

  async function startCheckout() {
    router.push("/app/billing");
  }

  async function runQuickAnalysis(mode: AnalysisMode) {
    if (!activeSnapshot?.snapshotId) {
      setError("Paste a URL first to create a snapshot.");
      return;
    }
    if (isLoading) return;
    setError(null);
    setNeedsUpgrade(false);
    setOveragePrompt(null);
    setPendingAnalysis(null);
    setIsLoading(true);
    try {
      await runAnalysis({
        snapshotId: activeSnapshot.snapshotId,
        mode,
        instruction: "",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to run analysis");
      void refreshHeaderStats();
    } finally {
      setAbortController(null);
      setIsLoading(false);
    }
  }

  async function confirmOverageAndRetry() {
    if (!pendingAnalysis) return;
    setError(null);
    setOveragePrompt(null);
    try {
      const unlock = await fetch("/api/billing/overage-unlock", { method: "POST" });
      if (!unlock.ok) {
        const t = await unlock.text().catch(() => "");
        throw new Error(`Failed to unlock overage: HTTP ${unlock.status} ${t}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to unlock overage");
      return;
    }

    setIsLoading(true);
    try {
      const toRun = pendingAnalysis;
      setPendingAnalysis(null);
      await runAnalysis(toRun);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Retry failed");
    } finally {
      setAbortController(null);
      setIsLoading(false);
    }
  }

  function renderMessage(message: ChatMessage) {
    const isAssistant = message.role === "assistant";

    if (message.kind === "result" && message.csv) {
      const html =
        message.html ||
        ((message.raw as { html?: string } | undefined)?.html ?? "") ||
        "";
      const parsed = parseCsvChecklistToText(message.csv);
      const copyText = parsed.text || message.csv || "";
      return (
        <div
          key={message.id}
          className={`flex ${isAssistant ? "justify-start" : "justify-end"}`}
        >
          <div className="max-w-full space-y-3 rounded-2xl border border-[color:rgba(15,23,42,0.10)] bg-[color:rgba(255,255,255,0.92)] p-3 text-sm shadow-[var(--shadow-sm)] md:max-w-3xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-wide text-[color:rgba(11,18,32,0.72)]">
                  QA checklist
                </div>
                <div className="mt-1 truncate text-sm font-semibold text-[color:rgba(11,18,32,0.92)]">
                  {message.content}
                </div>
                <div className="mt-1 text-[11px] text-[color:rgba(11,18,32,0.62)]">
                  {parsed.items.length} checks • paste URLs above (one per line)
                </div>
              </div>
              <button
                type="button"
                onClick={async () => {
                  try {
                    if (!copyText) return;
                    await navigator.clipboard.writeText(copyText);
                  } catch {
                    // ignore
                  }
                }}
                disabled={!copyText}
                className="h-8 shrink-0 rounded-lg border border-[color:rgba(15,23,42,0.12)] bg-white/85 px-3 text-xs font-semibold text-[color:rgba(11,18,32,0.88)] hover:bg-white"
              >
                Copy
              </button>
            </div>

            <div className="rounded-xl border border-[color:rgba(15,23,42,0.10)] bg-[color:rgba(15,23,42,0.02)] p-3">
              <div className="text-xs font-semibold text-[color:rgba(11,18,32,0.74)]">
                Checklist (view/copy in-app)
              </div>
              <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap text-[12px] leading-relaxed text-[color:rgba(11,18,32,0.84)]">
                {parsed.text || "(empty)"}
              </pre>
            </div>

            <div className="rounded-xl border border-[color:rgba(15,23,42,0.10)] bg-[color:rgba(255,255,255,0.75)] p-3">
              <div className="text-xs font-semibold text-[color:rgba(11,18,32,0.74)]">
                Export
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    const blob = new Blob([message.csv as string], {
                      type: "text/csv",
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `checklist_${Date.now()}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="h-8 rounded-lg border border-[color:rgba(15,23,42,0.12)] bg-white/85 px-3 text-xs font-semibold text-[color:rgba(11,18,32,0.88)] hover:bg-white"
                >
                  Download CSV
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (message.kind === "result" && message.markdown) {
      const text = message.markdown;
      return (
        <div
          key={message.id}
          className={`flex ${isAssistant ? "justify-start" : "justify-end"}`}
        >
          <div className="max-w-full space-y-3 rounded-2xl border border-[color:rgba(15,23,42,0.10)] bg-[color:rgba(255,255,255,0.92)] p-3 text-sm shadow-[var(--shadow-sm)] md:max-w-3xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-wide text-[color:rgba(11,18,32,0.72)]">
                  UI/UX audit
                </div>
                <div className="mt-1 truncate text-sm font-semibold text-[color:rgba(11,18,32,0.92)]">
                  {message.content}
                </div>
              </div>
              <button
                type="button"
                onClick={async () => {
                  try {
                    if (!text) return;
                    await navigator.clipboard.writeText(text);
                  } catch {
                    // ignore
                  }
                }}
                disabled={!text}
                className="h-8 shrink-0 rounded-lg border border-[color:rgba(15,23,42,0.12)] bg-white/85 px-3 text-xs font-semibold text-[color:rgba(11,18,32,0.88)] hover:bg-white"
              >
                Copy
              </button>
            </div>

            <div className="rounded-xl border border-[color:rgba(15,23,42,0.10)] bg-[color:rgba(15,23,42,0.02)] p-3">
              <div className="text-xs font-semibold text-[color:rgba(11,18,32,0.74)]">
                Report (Markdown)
              </div>
              <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap text-[12px] leading-relaxed text-[color:rgba(11,18,32,0.84)]">
                {text}
              </pre>
            </div>
          </div>
        </div>
      );
    }

    const bubbleClasses = isAssistant
      ? "bg-[color:rgba(255,255,255,0.88)] border-[color:rgba(15,23,42,0.10)] text-[color:rgba(11,18,32,0.90)]"
      : "bg-[color:rgba(97,106,243,0.12)] border-[color:rgba(97,106,243,0.22)] text-[color:rgba(11,18,32,0.92)]";

    const textClasses =
      message.kind === "status"
        ? "text-xs text-[color:rgba(11,18,32,0.68)]"
        : "text-sm";

    return (
      <div
        key={message.id}
        className={`flex ${isAssistant ? "justify-start" : "justify-end"}`}
      >
        <div
          className={`max-w-full rounded-2xl border px-3 py-2 shadow-sm md:max-w-3xl ${bubbleClasses}`}
        >
          <p className={textClasses}>{message.content}</p>
        </div>
      </div>
    );
  }

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
                <Link
                  href="/app"
                  onClick={() => setDrawerOpen(false)}
                  className="flex items-center gap-3"
                >
                  <div className="h-9 w-9 rounded-2xl bg-gradient-to-br from-[color:var(--accent)] to-[color:var(--accent-2)] shadow-[0_16px_34px_rgba(97,106,243,0.18)]" />
                  <div>
                    <div className="text-sm font-semibold leading-4">WebMorpher</div>
                    <div className="text-[11px] text-[color:rgba(11,18,32,0.60)]">
                      Workspace
                    </div>
                  </div>
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
                <ChatList />
              </div>

              <div className="mt-4 flex items-center justify-between gap-2 rounded-xl border border-[color:rgba(15,23,42,0.10)] bg-[color:rgba(15,23,42,0.02)] p-3">
                <div className="text-xs text-[color:rgba(11,18,32,0.74)]">
                  {credits === null ? "…" : `${credits} free`}
                </div>
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="h-8 rounded-lg border border-[color:rgba(15,23,42,0.12)] bg-white/85 px-3 text-xs font-semibold text-[color:rgba(11,18,32,0.84)] hover:bg-white"
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <header className="mb-3 flex flex-wrap items-start justify-between gap-3 border-b border-[color:rgba(15,23,42,0.08)] pb-2">
        <div className="flex min-w-0 items-start gap-2">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[color:rgba(15,23,42,0.12)] bg-white/85 text-[color:rgba(11,18,32,0.78)] md:hidden"
            aria-label="Open menu"
          >
            ☰
          </button>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold">WebMorpher</h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-full border border-[color:rgba(97,106,243,0.28)] bg-[color:rgba(97,106,243,0.12)] px-3 py-1 text-[11px] font-medium text-[color:rgba(11,18,32,0.84)]">
            {credits === null ? "…" : `${credits} free`}
          </div>
          {billing?.plan && billing.includedMonthlyLimit > 0 && (
            <div className="rounded-full border border-[color:rgba(15,23,42,0.12)] bg-[color:rgba(255,255,255,0.80)] px-3 py-1 text-[11px] font-medium text-[color:rgba(11,18,32,0.84)]">
              Used {billing.periodIncludedUsed} · Remaining {billing.includedRemaining}/{billing.includedMonthlyLimit}
            </div>
          )}
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="rounded-full border border-[color:rgba(15,23,42,0.12)] bg-[color:rgba(255,255,255,0.85)] px-3 py-1 text-[11px] font-medium text-[color:rgba(11,18,32,0.84)] hover:bg-[color:rgba(255,255,255,0.95)]"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
        <div className="flex-1 space-y-2 overflow-y-auto rounded-[var(--radius-sm)] border border-[color:rgba(15,23,42,0.10)] bg-[color:rgba(15,23,42,0.02)] p-3">
          {messages.map((m) => renderMessage(m))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="inline-flex items-center gap-2 rounded-2xl border border-[color:rgba(15,23,42,0.10)] bg-[color:rgba(255,255,255,0.8)] px-3 py-1.5 text-xs text-[color:rgba(11,18,32,0.72)]">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[color:var(--ok)]" />
                Working…
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-lg border border-[color:rgba(239,68,68,0.25)] bg-[color:rgba(239,68,68,0.08)] px-3 py-1.5 text-xs text-[color:rgba(185,28,28,0.95)]">
            {error}
          </div>
        )}
        {needsUpgrade && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-[color:rgba(97,106,243,0.22)] bg-[color:rgba(97,106,243,0.08)] px-3 py-2">
            <div className="text-xs text-[color:rgba(11,18,32,0.82)]">
              You’ve used your 5 free analyses. Upgrade to continue.
            </div>
            <button
              type="button"
              onClick={startCheckout}
              className="h-8 rounded-lg bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--accent-2)] px-3 text-xs font-semibold text-white shadow-[0_16px_34px_rgba(97,106,243,0.22)] hover:brightness-[1.02]"
            >
              Upgrade
            </button>
          </div>
        )}

        {overagePrompt && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-[color:rgba(251,191,36,0.30)] bg-[color:rgba(251,191,36,0.10)] px-3 py-2">
            <div className="text-xs text-[color:rgba(11,18,32,0.82)]">
              This request would exceed your overage limit of{" "}
              <span className="font-semibold">
                ${centsToDollars(overagePrompt.overageLimitCents).toFixed(2)}
              </span>{" "}
              (projected{" "}
              <span className="font-semibold">
                ${centsToDollars(overagePrompt.projectedOverageCents).toFixed(2)}
              </span>
              ). Continue and unlock overage until period end?
            </div>
            <button
              type="button"
              onClick={confirmOverageAndRetry}
              className="h-8 rounded-lg bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--accent-2)] px-3 text-xs font-semibold text-white shadow-[0_16px_34px_rgba(97,106,243,0.22)] hover:brightness-[1.02]"
            >
              Continue
            </button>
          </div>
        )}

        <div className="mt-1 flex flex-col gap-2">
          <div className="flex flex-wrap items-end gap-2 rounded-[var(--radius)] border border-[color:rgba(15,23,42,0.10)] bg-[color:rgba(255,255,255,0.75)] px-3 py-2">
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-[color:rgba(11,18,32,0.78)]">
                Snapshot URL
              </div>
              <input
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                disabled={!activeChatId || isLoading}
                placeholder="https://example.com"
                className="mt-1 h-9 w-full min-w-0 rounded-xl border border-[color:rgba(15,23,42,0.12)] bg-white/95 px-3 text-sm text-[color:rgba(11,18,32,0.92)] outline-none focus:border-[color:rgba(97,106,243,0.65)] focus:shadow-[0_0_0_4px_rgba(97,106,243,0.16)] disabled:cursor-not-allowed disabled:opacity-60"
              />
              <div className="mt-1 text-[11px] text-[color:rgba(11,18,32,0.55)]">
                Tip: you can paste domains too (we’ll normalize to https). Or type {SNAPSHOT_COMMAND} in the prompt box.
              </div>
            </div>

            <button
              type="button"
              onClick={handleMakeSnapshot}
              disabled={!activeChatId || isLoading || !urlInput.trim()}
              className="h-10 shrink-0 rounded-xl bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--accent-2)] px-4 text-sm font-semibold text-white shadow-[0_16px_34px_rgba(97,106,243,0.22)] hover:brightness-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Make snapshot
            </button>
          </div>

          {activeSnapshot && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius)] border border-[color:rgba(15,23,42,0.10)] bg-[color:rgba(255,255,255,0.70)] px-3 py-2">
              <div className="min-w-0 text-xs text-[color:rgba(11,18,32,0.78)]">
                Active snapshot: <span className="font-semibold">{activeSnapshot.url}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => runQuickAnalysis("qa_checklist")}
                  disabled={isLoading}
                  className="h-8 rounded-lg border border-[color:rgba(15,23,42,0.12)] bg-white/85 px-3 text-xs font-semibold text-[color:rgba(11,18,32,0.88)] hover:bg-white disabled:opacity-60"
                >
                  Generate QA checklist
                </button>
                <button
                  type="button"
                  onClick={() => runQuickAnalysis("uiux_audit")}
                  disabled={isLoading}
                  className="h-8 rounded-lg border border-[color:rgba(15,23,42,0.12)] bg-white/85 px-3 text-xs font-semibold text-[color:rgba(11,18,32,0.88)] hover:bg-white disabled:opacity-60"
                >
                  UI/UX audit
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <div className="text-xs font-semibold text-[color:rgba(11,18,32,0.72)]">
              Analyze as:
            </div>
            <div className="inline-flex overflow-hidden rounded-xl border border-[color:rgba(15,23,42,0.12)] bg-[color:rgba(255,255,255,0.85)]">
              <button
                type="button"
                aria-pressed={selectedMode === "qa_checklist"}
                onClick={() => setSelectedMode("qa_checklist")}
                className={[
                  "h-8 px-3 text-xs font-semibold transition",
                  selectedMode === "qa_checklist"
                    ? "bg-[color:rgba(97,106,243,0.14)] text-[color:rgba(11,18,32,0.92)]"
                    : "text-[color:rgba(11,18,32,0.70)] hover:bg-[color:rgba(15,23,42,0.04)]",
                ].join(" ")}
              >
                QA checklist
              </button>
              <button
                type="button"
                aria-pressed={selectedMode === "uiux_audit"}
                onClick={() => setSelectedMode("uiux_audit")}
                className={[
                  "h-8 px-3 text-xs font-semibold transition",
                  selectedMode === "uiux_audit"
                    ? "bg-[color:rgba(97,106,243,0.14)] text-[color:rgba(11,18,32,0.92)]"
                    : "text-[color:rgba(11,18,32,0.70)] hover:bg-[color:rgba(15,23,42,0.04)]",
                ].join(" ")}
              >
                UI/UX audit
              </button>
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="rounded-[var(--radius)] border border-[color:rgba(97,106,243,0.25)] bg-[color:rgba(97,106,243,0.06)] p-3"
          >
            <div className="text-xs font-semibold text-[color:rgba(11,18,32,0.80)]">
              Ask the AI (uses the active snapshot)
            </div>
            <div className="mt-2">
              <textarea
                rows={3}
                disabled={!activeChatId || isLoading}
                className="w-full resize-none rounded-xl border border-[color:rgba(97,106,243,0.28)] bg-[color:rgba(255,255,255,0.98)] px-3 py-2 text-sm text-[color:rgba(11,18,32,0.92)] outline-none placeholder:text-[color:rgba(11,18,32,0.45)] focus:border-[color:rgba(97,106,243,0.65)] focus:shadow-[0_0_0_4px_rgba(97,106,243,0.16)] disabled:cursor-not-allowed disabled:opacity-60"
                placeholder={"Ask for a QA checklist, or: audit UI/UX focusing on trust & conversion.\n\nOr type <make a snapshot> to capture the URL above."}
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
              />
            </div>
            <div className="mt-2 flex items-center justify-end gap-2">
              {isLoading ? (
                <button
                  type="button"
                  onClick={handleStop}
                  className="h-10 rounded-xl bg-[color:rgba(239,68,68,0.92)] px-4 text-sm font-medium text-white hover:bg-[color:rgba(239,68,68,0.82)]"
                >
                  Stop
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!activeChatId || !promptInput.trim()}
                  className="h-10 rounded-xl bg-[color:rgba(15,23,42,0.90)] px-4 text-sm font-medium text-white hover:bg-[color:rgba(15,23,42,0.82)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Send
                </button>
              )}
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}


