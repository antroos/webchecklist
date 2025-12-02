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
          <div className="max-w-full space-y-3 rounded-2xl border border-emerald-700 bg-zinc-900/80 p-3 text-sm shadow-lg shadow-emerald-900/40 md:max-w-3xl">
            <div className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
              Result
            </div>
            <div className="text-sm font-medium text-zinc-100">
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
                className="h-8 rounded-lg bg-emerald-600 px-3 text-xs font-medium text-white hover:bg-emerald-500"
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
                className="h-8 rounded-lg bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-500"
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
                className="h-8 rounded-lg bg-purple-600 px-3 text-xs font-medium text-white hover:bg-purple-500"
              >
                🌐 Download HTML
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <h3 className="text-xs font-semibold text-zinc-300">
                  CSV Checklist (preview)
                </h3>
                <pre className="max-h-64 overflow-auto rounded-lg border border-zinc-800 bg-black/70 p-2 text-[11px] text-zinc-100">
                  {(message.csv as string).slice(0, 4000)}
                </pre>
              </div>
              <div className="space-y-1">
                <h3 className="text-xs font-semibold text-zinc-300">
                  Raw Page Analysis (JSON snapshot)
                </h3>
                <pre className="max-h-64 overflow-auto rounded-lg border border-zinc-800 bg-black/70 p-2 text-[11px] text-zinc-100">
                  {JSON.stringify(message.raw, null, 2).slice(0, 4000)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      );
    }

    const bubbleClasses = isAssistant
      ? "bg-zinc-900/80 border-zinc-800 text-zinc-100"
      : "bg-emerald-600 text-black border-emerald-400";

    const textClasses =
      message.kind === "status" ? "text-xs text-zinc-300" : "text-sm";

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
    <div className="flex min-h-screen bg-zinc-950 text-zinc-50">
      <div className="m-auto flex h-[90vh] w-full max-w-5xl flex-col rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 shadow-2xl shadow-black/40">
        <header className="mb-3 flex items-center justify-between gap-3 border-b border-zinc-800 pb-2">
          <div>
            <h1 className="text-lg font-semibold">Web Checklist Assistant</h1>
            <p className="text-xs text-zinc-400">
              Chat interface for opening real pages in a browser, analyzing
              structure and generating CSV test checklists.
            </p>
          </div>
          <div className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-200">
            Live browser · CSV checklist
          </div>
        </header>

        <main className="flex flex-1 flex-col gap-3 overflow-hidden">
          <div className="flex-1 space-y-2 overflow-y-auto rounded-xl border border-zinc-800 bg-black/40 p-3">
            {messages.map((m) => renderMessage(m))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="inline-flex items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-xs text-zinc-300">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                  Analyzing page and generating checklist...
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs text-red-200">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-1 flex items-end gap-2">
            <div className="flex-1">
              <textarea
                rows={2}
                className="w-full resize-none rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-50 outline-none ring-0 focus:border-emerald-500"
                placeholder="Send a URL or instruction, e.g. “Проаналізуй snoopgame.com і зроби чекліст для всіх форм, кнопок і навігації”."
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
              <p className="mt-1 text-[11px] text-zinc-500">
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
                className="h-10 rounded-xl bg-red-500 px-4 text-sm font-medium text-white hover:bg-red-400"
              >
                Stop
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="h-10 rounded-xl bg-emerald-500 px-4 text-sm font-medium text-black hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-700"
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


