"use client";

import { FormEvent, useState } from "react";

type AnalysisResult = {
  url: string;
  csv: string;
  raw: any;
};

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  
  // Batch mode state
  const [batchMode, setBatchMode] = useState(false);
  const [batchFile, setBatchFile] = useState<File | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchProgress, setBatchProgress] = useState<string>("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);

    const cleanUrl = url.trim();
    if (!cleanUrl) {
      setError("Please enter a URL.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: cleanUrl }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }

      setResult({
        url: data.url,
        csv: data.csv,
        raw: data.raw,
      });
    } catch (err: any) {
      setError(err?.message ?? "Network error.");
    } finally {
      setLoading(false);
    }
  }

  async function handleBatchSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    
    if (!batchFile) {
      setError("Please select a file with URLs.");
      return;
    }

    setBatchLoading(true);
    setBatchProgress("Reading file...");

    try {
      const text = await batchFile.text();
      const urls = text
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"));

      if (urls.length === 0) {
        setError("No valid URLs found in the file.");
        setBatchLoading(false);
        return;
      }

      setBatchProgress(`Processing ${urls.length} URLs...`);

      const res = await fetch("/api/batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ urls }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Batch analysis failed.");
        return;
      }

      // Download ZIP file
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `batch_analysis_${Date.now()}.zip`;
      a.click();
      URL.revokeObjectURL(url);

      setBatchProgress(`✓ Done! Downloaded ZIP with ${urls.length} pages.`);
    } catch (err: any) {
      setError(err?.message ?? "Network error.");
    } finally {
      setBatchLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-50">
      <div className="m-auto w-full max-w-5xl rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 shadow-2xl shadow-black/40">
        <header className="mb-4 border-b border-zinc-800 pb-3">
          <div className="mb-3">
            <h1 className="text-xl font-semibold">
              Web Checklist Generator
            </h1>
            <p className="text-sm text-zinc-400">
              Analyze single page or batch process multiple URLs.
            </p>
          </div>
          
          {/* Mode toggle */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setBatchMode(false);
                setError(null);
                setBatchProgress("");
              }}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                !batchMode
                  ? "bg-emerald-600 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              }`}
            >
              Single URL
            </button>
            <button
              type="button"
              onClick={() => {
                setBatchMode(true);
                setError(null);
                setResult(null);
              }}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                batchMode
                  ? "bg-emerald-600 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              }`}
            >
              Batch (Upload file)
            </button>
          </div>
        </header>

        {!batchMode && (
          <form onSubmit={handleSubmit} className="mb-4 flex gap-2">
          <input
            type="text"
            className="h-11 flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm outline-none ring-0 focus:border-zinc-500"
            placeholder="https://example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <button
            type="submit"
            disabled={loading}
            className="h-11 rounded-lg bg-emerald-500 px-4 text-sm font-medium text-black hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-700"
          >
            {loading ? "Analyzing..." : "Generate checklist"}
          </button>
        </form>
        )}

        {batchMode && (
          <form onSubmit={handleBatchSubmit} className="mb-4 space-y-3">
            <div className="flex gap-2">
              <input
                type="file"
                accept=".txt"
                onChange={(e) => {
                  setBatchFile(e.target.files?.[0] || null);
                  setError(null);
                }}
                className="h-11 flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm file:mr-4 file:rounded file:border-0 file:bg-emerald-600 file:px-3 file:py-1 file:text-xs file:font-medium file:text-white hover:file:bg-emerald-500"
              />
              <button
                type="submit"
                disabled={batchLoading || !batchFile}
                className="h-11 rounded-lg bg-emerald-500 px-4 text-sm font-medium text-black hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-700"
              >
                {batchLoading ? "Processing..." : "Analyze batch"}
              </button>
            </div>
            <p className="text-xs text-zinc-500">
              Upload a .txt file with one URL per line. Example: <br />
              <code className="text-zinc-300">
                snoopgame.com
                <br />
                langfuse.com
                <br />
                example.com
              </code>
            </p>
            {batchProgress && (
              <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
                {batchProgress}
              </div>
            )}
          </form>
        )}

        {error && (
          <div className="mb-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        )}

        {!batchMode && !result && !error && !loading && (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 text-sm text-zinc-400">
            Example: <code className="text-zinc-200">snoopgame.com</code> or{" "}
            <code className="text-zinc-200">langfuse.com</code>. We&apos;ll
            return a CSV checklist plus full page analysis (HTML/CSS/JS/meta).
          </div>
        )}

        {result && (
          <div className="mt-4 space-y-4">
            {/* Download buttons */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  const blob = new Blob([result.csv], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `checklist_${Date.now()}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="h-9 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-500"
              >
                📄 Download CSV
              </button>
              <button
                onClick={() => {
                  const blob = new Blob([JSON.stringify(result.raw, null, 2)], {
                    type: "application/json",
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `analysis_${Date.now()}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="h-9 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-500"
              >
                📊 Download JSON
              </button>
              <button
                onClick={() => {
                  const blob = new Blob([result.raw?.html || ""], {
                    type: "text/html",
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `page_copy_${Date.now()}.html`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="h-9 rounded-lg bg-purple-600 px-4 text-sm font-medium text-white hover:bg-purple-500"
              >
                🌐 Download HTML
              </button>
            </div>

            {/* Preview panels */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <h2 className="text-sm font-semibold text-zinc-200">
                  CSV Checklist (preview)
                </h2>
                <pre className="max-h-64 overflow-auto rounded-lg border border-zinc-800 bg-black/70 p-3 text-xs text-zinc-200">
                  {result.csv.slice(0, 4000)}
                </pre>
              </div>
              <div className="space-y-2">
                <h2 className="text-sm font-semibold text-zinc-200">
                  Raw Page Analysis (JSON snapshot)
                </h2>
                <pre className="max-h-64 overflow-auto rounded-lg border border-zinc-800 bg-black/70 p-3 text-xs text-zinc-200">
                  {JSON.stringify(result.raw, null, 2).slice(0, 4000)}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

