"use client";

import { FormEvent, useState } from "react";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  kind?: "status" | "result" | "plain";
  csv?: string;
  raw?: unknown;
};

// SSE event types from /api/agent
type SSEEvent =
  | { type: "log"; message: string }
  | { type: "result"; url: string; csv: string; raw: unknown }
  | { type: "error"; message: string };

export default function Home() {
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
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    setError(null);

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

    const controller = new AbortController();
    setAbortController(controller);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: nextMessages.map(({ role, content }) => ({ role, content })),
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
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
            const event = JSON.parse(jsonStr);

            if (event.type === "log") {
              // Add log message as a status message
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
              // Add final result
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

  function renderMessage(message: ChatMessage) {
    const isAssistant = message.role === "assistant";

    if (message.kind === "result" && message.csv && message.raw) {
      return (
        <div
          key={message.id}
          className={`flex ${isAssistant ? "justify-start" : "justify-end"}`}
        >
          <div className="max-w-full space-y-3 rounded-2xl border border-[color:rgba(15,23,42,0.10)] bg-[color:rgba(255,255,255,0.88)] p-3 text-sm shadow-[var(--shadow-sm)] md:max-w-3xl">
            <div className="text-xs font-semibold uppercase tracking-wide text-[color:rgba(11,18,32,0.72)]">
              Result
            </div>
            <div className="text-sm font-medium text-[color:rgba(11,18,32,0.92)]">
              {message.content}
            </div>

            <div className="flex flex-wrap gap-2">
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
                className="h-8 rounded-lg bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--accent-2)] px-3 text-xs font-semibold text-white shadow-[0_16px_34px_rgba(97,106,243,0.22)] hover:brightness-[1.02]"
              >
                📄 Download CSV
              </button>
              <button
                onClick={() => {
                  const blob = new Blob(
                    [JSON.stringify(message.raw, null, 2)],
                    {
                      type: "application/json",
                    },
                  );
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `analysis_${Date.now()}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="h-8 rounded-lg border border-[color:rgba(15,23,42,0.12)] bg-[color:rgba(255,255,255,0.85)] px-3 text-xs font-semibold text-[color:rgba(11,18,32,0.88)] hover:bg-[color:rgba(255,255,255,0.95)]"
              >
                📊 Download JSON
              </button>
              <button
                onClick={() => {
                  const html =
                    (message.raw as { html?: string } | undefined)?.html || "";
                  const blob = new Blob([html], { type: "text/html" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `page_copy_${Date.now()}.html`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="h-8 rounded-lg border border-[color:rgba(97,106,243,0.22)] bg-[color:rgba(97,106,243,0.10)] px-3 text-xs font-semibold text-[color:rgba(11,18,32,0.88)] hover:bg-[color:rgba(97,106,243,0.14)]"
              >
                🌐 Download HTML
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <h3 className="text-xs font-semibold text-[color:rgba(11,18,32,0.72)]">
                  CSV Checklist (preview)
                </h3>
                <pre className="max-h-64 overflow-auto rounded-lg border border-[color:rgba(15,23,42,0.10)] bg-[color:rgba(255,255,255,0.92)] p-2 text-[11px] text-[color:rgba(11,18,32,0.86)]">
                  {(message.csv as string).slice(0, 4000)}
                </pre>
              </div>
              <div className="space-y-1">
                <h3 className="text-xs font-semibold text-[color:rgba(11,18,32,0.72)]">
                  Raw Page Analysis (JSON snapshot)
                </h3>
                <pre className="max-h-64 overflow-auto rounded-lg border border-[color:rgba(15,23,42,0.10)] bg-[color:rgba(255,255,255,0.92)] p-2 text-[11px] text-[color:rgba(11,18,32,0.86)]">
                  {JSON.stringify(message.raw, null, 2).slice(0, 4000)}
                </pre>
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
    <div className="flex min-h-screen bg-[color:var(--bg)] text-[color:var(--text)]">
      <div className="m-auto flex h-[90vh] w-full max-w-5xl flex-col rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--card)] p-4 shadow-[var(--shadow)]">
        <header className="mb-3 flex items-center justify-between gap-3 border-b border-[color:rgba(15,23,42,0.08)] pb-2">
          <div>
            <h1 className="text-lg font-semibold">WebTest</h1>
            <p className="text-xs text-[color:rgba(11,18,32,0.72)]">
              Chat interface for opening real pages in a browser, analyzing
              structure and generating CSV test checklists.
            </p>
          </div>
          <div className="rounded-full border border-[color:rgba(97,106,243,0.28)] bg-[color:rgba(97,106,243,0.12)] px-3 py-1 text-[11px] font-medium text-[color:rgba(11,18,32,0.84)]">
            Real browser · CSV checklist
          </div>
        </header>

        <main className="flex flex-1 flex-col gap-3 overflow-hidden">
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

          <form onSubmit={handleSubmit} className="mt-1 flex items-end gap-2">
            <div className="flex-1">
              <textarea
                rows={2}
                className="w-full resize-none rounded-xl border border-[color:rgba(15,23,42,0.12)] bg-[color:rgba(255,255,255,0.95)] px-3 py-2 text-sm text-[color:rgba(11,18,32,0.9)] outline-none ring-0 placeholder:text-[color:rgba(11,18,32,0.45)] focus:border-[color:rgba(97,106,243,0.55)] focus:shadow-[0_0_0_4px_rgba(97,106,243,0.14)]"
                placeholder="Send a URL or instruction, e.g. “Проаналізуй snoopgame.com і зроби чекліст для всіх форм, кнопок і навігації”."
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
              <p className="mt-1 text-[11px] text-[color:rgba(11,18,32,0.60)]">
                Tip: you can just paste a domain like <code>snoopgame.com</code>
                {" "}
                – the assistant will normalize it to https:// and open in
                browser.
              </p>
            </div>
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
                disabled={!input.trim()}
                className="h-10 rounded-xl bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--accent-2)] px-4 text-sm font-semibold text-white shadow-[0_16px_34px_rgba(97,106,243,0.28)] hover:brightness-[1.02] disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
              >
                Send
              </button>
            )}
          </form>
        </main>
      </div>
    </div>
  );
}


