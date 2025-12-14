"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  kind?: "status" | "result" | "plain";
  csv?: string;
  raw?: unknown;
  html?: string;
  reportText?: string; // human-friendly rendering for in-app report (derived from csv)
};

// SSE event types from /api/agent
type SSEEvent =
  | { type: "log"; message: string }
  | { type: "result"; url: string; csv: string; raw: unknown }
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

function parseCsvChecklistToText(csv: string): { title: string; items: string[]; text: string } {
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return { title: "QA checklist", items: [], text: "" };
  // Skip header if present
  const start = lines[0].toLowerCase().startsWith("check,") ? 1 : 0;
  const checks: string[] = [];
  for (const line of lines.slice(start)) {
    // CSV row starts with "Check description",...
    const m = line.match(/^"([^"]+)"/);
    const check = (m?.[1] ?? "").trim();
    if (check) checks.push(check);
  }
  if (!checks.length) return { title: "QA checklist", items: [], text: "" };

  const text = checks.map((c) => `- ${c}`).join("\n");
  return { title: "QA checklist", items: checks, text };
}

export default function AppClient({ chatId }: { chatId: string | null }) {
  const router = useRouter();
  const [credits, setCredits] = useState<number | null>(null);
  const [billing, setBilling] = useState<BillingStatusMini | null>(null);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      kind: "plain",
      content:
        "Paste a page URL (for example snoopgame.com or langfuse.com). I will open it in a real browser, analyze the structure and generate a CSV checklist for testing.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [abortController, setAbortController] =
    useState<AbortController | null>(null);
  const [needsUpgrade, setNeedsUpgrade] = useState(false);
  const [overagePrompt, setOveragePrompt] = useState<OverageCapPayload | null>(null);
  const [pendingMessages, setPendingMessages] = useState<ChatMessage[] | null>(null);

  const requestId = useMemo(() => {
    // One id per page load; used for idempotent credit reservation server-side.
    return typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `rid-${Date.now()}-${Math.random()}`;
  }, []);

  async function persistMessage(params: {
    chatId: string;
    role: "user" | "assistant";
    kind: "status" | "result" | "plain";
    content: string;
    artifacts?: { csv?: string; raw?: unknown; html?: string };
  }) {
    try {
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
      if (!res.ok) return false;
      const data = (await res.json()) as { messages?: any[] };
      const list = Array.isArray(data.messages) ? data.messages : [];
      setMessages(
        list.map((m) => ({
          id: String(m.id ?? `m-${Math.random()}`),
          role: m.role === "user" ? "user" : "assistant",
          kind: m.kind === "status" || m.kind === "result" || m.kind === "plain" ? m.kind : "plain",
          content: typeof m.content === "string" ? m.content : "",
          csv: typeof m.artifacts?.csv === "string" ? m.artifacts.csv : undefined,
          raw: typeof m.artifacts?.raw !== "undefined" ? m.artifacts.raw : undefined,
          html: typeof m.artifacts?.html === "string" ? m.artifacts.html : undefined,
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
    let cancelled = false;

    async function ensure() {
      if (!chatId) {
        setActiveChatId(null);
        try {
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
        return;
      }

      setActiveChatId(chatId);
      const ok = await loadChat(chatId);
      if (!ok) {
        // Fallback: if chat does not exist (or access denied), create a new one.
        try {
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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    setError(null);
    setNeedsUpgrade(false);
    setOveragePrompt(null);
    setPendingMessages(null);

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      kind: "plain",
      content: input.trim(),
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setIsLoading(true);

    if (activeChatId) {
      void persistMessage({
        chatId: activeChatId,
        role: "user",
        kind: "plain",
        content: userMessage.content,
      });
    }

    const controller = new AbortController();
    setAbortController(controller);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requestId,
          messages: nextMessages.map(({ role, content }) => ({ role, content })),
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        // Preserve old behavior, but surface the error text if possible.
        if (res.status === 409) {
          const data = (await res.json().catch(() => null)) as OverageCapPayload | null;
          if (data && data.error === "OVERAGE_CAP") {
            setOveragePrompt(data);
            setPendingMessages(nextMessages);
            return;
          }
        }

        const text = await res.text().catch(() => "");
        if (res.status === 402) {
          setNeedsUpgrade(true);
        }
        throw new Error(
          `HTTP ${res.status}: ${res.statusText}${text ? ` — ${text}` : ""}`,
        );
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response body");
      }

      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim() || !line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6); // Remove "data: " prefix
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
              // Credits were reserved server-side; refresh after the run.
              void refreshHeaderStats();
              const rawAny = event.raw as any;
              const html = typeof rawAny?.html === "string" ? rawAny.html : undefined;
              const msg: ChatMessage = {
                id: `result-${Date.now()}`,
                role: "assistant",
                kind: "result",
                content: `Checklist for ${event.url}`,
                csv: event.csv,
                raw: event.raw,
                html,
              };
              setMessages((prev) => [...prev, msg]);
              if (activeChatId) {
                void persistMessage({
                  chatId: activeChatId,
                  role: "assistant",
                  kind: "result",
                  content: msg.content,
                  artifacts: { csv: msg.csv, raw: msg.raw, html: msg.html },
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
            : "Network error while calling /api/agent.";
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

  async function confirmOverageAndRetry() {
    if (!pendingMessages) return;
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

    // Retry by reusing the last messages list.
    setIsLoading(true);
    const controller = new AbortController();
    setAbortController(controller);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          messages: pendingMessages.map(({ role, content }) => ({ role, content })),
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
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
              setMessages((prev) => [
                ...prev,
                {
                  id: `log-${Date.now()}-${Math.random()}`,
                  role: "assistant",
                  kind: "status",
                  content: event.message,
                },
              ]);
            } else if (event.type === "result") {
              void refreshHeaderStats();
              setMessages((prev) => [
                ...prev,
                {
                  id: `result-${Date.now()}`,
                  role: "assistant",
                  kind: "result",
                  content: `Checklist for ${event.url}`,
                  csv: event.csv,
                  raw: event.raw,
                },
              ]);
            } else if (event.type === "error") {
              setError(event.message);
              void refreshHeaderStats();
              setMessages((prev) => [
                ...prev,
                {
                  id: `err-${Date.now()}`,
                  role: "assistant",
                  kind: "plain",
                  content: event.message,
                },
              ]);
            }
          } catch (parseErr) {
            console.warn("Failed to parse SSE event:", line, parseErr);
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Retry failed");
    } finally {
      setAbortController(null);
      setIsLoading(false);
      setPendingMessages(null);
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
        <header className="mb-3 flex items-center justify-between gap-3 border-b border-[color:rgba(15,23,42,0.08)] pb-2">
          <div>
            <h1 className="text-lg font-semibold">WebMorpher</h1>
            <p className="text-xs text-[color:rgba(11,18,32,0.72)]">
              Chat interface for opening real pages in a browser, analyzing
              structure and generating CSV test checklists.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-full border border-[color:rgba(97,106,243,0.28)] bg-[color:rgba(97,106,243,0.12)] px-3 py-1 text-[11px] font-medium text-[color:rgba(11,18,32,0.84)]">
              {credits === null ? "…" : `${credits} free`}
            </div>
            {billing?.plan && billing.includedMonthlyLimit > 0 && (
              <div className="rounded-full border border-[color:rgba(15,23,42,0.12)] bg-[color:rgba(255,255,255,0.80)] px-3 py-1 text-[11px] font-medium text-[color:rgba(11,18,32,0.84)]">
                Used {billing.periodIncludedUsed} · Remaining {billing.includedRemaining}/
                {billing.includedMonthlyLimit}
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
                  Analyzing page and generating checklist...
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

          <form onSubmit={handleSubmit} className="mt-1 flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-xs font-semibold text-[color:rgba(11,18,32,0.72)]">
                Analyze as:
              </div>
              <div className="inline-flex overflow-hidden rounded-xl border border-[color:rgba(15,23,42,0.12)] bg-[color:rgba(255,255,255,0.85)]">
                <button
                  type="button"
                  aria-pressed={true}
                  className={[
                    "h-8 px-3 text-xs font-semibold transition",
                    "bg-[color:rgba(97,106,243,0.14)] text-[color:rgba(11,18,32,0.92)]",
                  ].join(" ")}
                >
                  QA checklist
                </button>
                <button
                  type="button"
                  disabled
                  className="h-8 px-3 text-xs font-semibold text-[color:rgba(11,18,32,0.45)]"
                >
                  UI/UX audit (soon)
                </button>
              </div>
            </div>

            <div className="rounded-[var(--radius)] border border-[color:rgba(97,106,243,0.25)] bg-[color:rgba(97,106,243,0.06)] p-3">
              <div className="text-xs font-semibold text-[color:rgba(11,18,32,0.80)]">
                Paste 1+ URLs (one per line)
              </div>
              <div className="mt-2">
                <textarea
                  rows={3}
                  className="w-full resize-none rounded-xl border border-[color:rgba(97,106,243,0.28)] bg-[color:rgba(255,255,255,0.98)] px-3 py-2 text-sm text-[color:rgba(11,18,32,0.92)] outline-none placeholder:text-[color:rgba(11,18,32,0.45)] focus:border-[color:rgba(97,106,243,0.65)] focus:shadow-[0_0_0_4px_rgba(97,106,243,0.16)]"
                  placeholder={"https://snoopgame.com\\nhttps://langfuse.com"}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                />
              </div>
              <div className="mt-2 text-[11px] text-[color:rgba(11,18,32,0.60)]">
                Tip: you can paste domains too (we’ll normalize to https).
              </div>
            </div>
            {isLoading ? (
              <button
                type="button"
                onClick={handleStop}
                className="h-10 self-end rounded-xl bg-[color:rgba(239,68,68,0.92)] px-4 text-sm font-medium text-white hover:bg-[color:rgba(239,68,68,0.82)]"
              >
                Stop
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="h-10 self-end rounded-xl bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--accent-2)] px-5 text-sm font-semibold text-white shadow-[0_16px_34px_rgba(97,106,243,0.28)] hover:brightness-[1.02] disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
              >
                Analyze
              </button>
            )}
          </form>
        </main>
    </div>
  );
}


