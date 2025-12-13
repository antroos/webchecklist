"use client";

import { useEffect } from "react";
import { signIn } from "next-auth/react";

export default function SignInClient({ callbackUrl }: { callbackUrl: string }) {
  useEffect(() => {
    const canIngest =
      typeof window !== "undefined" &&
      (window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1");

    // #region agent log
    if (canIngest) {
      fetch("http://127.0.0.1:7242/ingest/e38c11ec-9fba-420e-88d7-64588137f26f", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "debug-session",
          runId: "pre-fix",
          hypothesisId: "H1",
          location: "web/src/app/auth/signin/SignInClient.tsx:mount",
          message: "SignInClient mounted",
          data: {
            href: typeof window !== "undefined" ? window.location.href : null,
            origin: typeof window !== "undefined" ? window.location.origin : null,
            host: typeof window !== "undefined" ? window.location.host : null,
            callbackUrl,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
    }
    // #endregion agent log

    void (async () => {
      try {
        const res = await fetch("/api/auth/providers");
        const text = await res.text();
        let googleSigninUrlHost: string | null = null;
        let googleCallbackUrlHost: string | null = null;
        try {
          const json = JSON.parse(text) as {
            google?: { signinUrl?: string; callbackUrl?: string };
          };
          const signin = json.google?.signinUrl ? new URL(json.google.signinUrl) : null;
          const cb = json.google?.callbackUrl ? new URL(json.google.callbackUrl) : null;
          googleSigninUrlHost = signin?.host ?? null;
          googleCallbackUrlHost = cb?.host ?? null;
        } catch {
          // ignore parse errors; we'll still log status
        }

        // #region agent log
        if (canIngest) {
          fetch("http://127.0.0.1:7242/ingest/e38c11ec-9fba-420e-88d7-64588137f26f", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId: "debug-session",
              runId: "pre-fix",
              hypothesisId: "H1",
              location: "web/src/app/auth/signin/SignInClient.tsx:providers",
              message: "Fetched /api/auth/providers",
              data: {
                status: res.status,
                origin: typeof window !== "undefined" ? window.location.origin : null,
                host: typeof window !== "undefined" ? window.location.host : null,
                googleSigninUrlHost,
                googleCallbackUrlHost,
                rawLen: text.length,
              },
              timestamp: Date.now(),
            }),
          }).catch(() => {});
        }
        // #endregion agent log
      } catch (e) {
        // #region agent log
        if (canIngest) {
          fetch("http://127.0.0.1:7242/ingest/e38c11ec-9fba-420e-88d7-64588137f26f", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId: "debug-session",
              runId: "pre-fix",
              hypothesisId: "H2",
              location: "web/src/app/auth/signin/SignInClient.tsx:providers-error",
              message: "Failed to fetch /api/auth/providers",
              data: { error: e instanceof Error ? e.message : String(e) },
              timestamp: Date.now(),
            }),
          }).catch(() => {});
        }
        // #endregion agent log
      }
    })();
  }, [callbackUrl]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[color:var(--bg)] px-6 text-[color:var(--text)]">
      <div className="w-full max-w-md rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--card)] p-6 shadow-[var(--shadow)]">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-[color:var(--accent)] to-[color:var(--accent-2)] shadow-[0_16px_34px_rgba(97,106,243,0.22)]" />
          <div>
            <h1 className="text-lg font-semibold">Sign in</h1>
            <p className="text-xs text-[color:rgba(11,18,32,0.72)]">
              5 free analyses, then subscription.
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            // #region agent log
            if (
              typeof window !== "undefined" &&
              (window.location.hostname === "localhost" ||
                window.location.hostname === "127.0.0.1")
            ) {
              fetch(
                "http://127.0.0.1:7242/ingest/e38c11ec-9fba-420e-88d7-64588137f26f",
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    sessionId: "debug-session",
                    runId: "pre-fix",
                    hypothesisId: "H1",
                    location: "web/src/app/auth/signin/SignInClient.tsx:click",
                    message: "Clicked Continue with Google",
                    data: {
                      href:
                        typeof window !== "undefined"
                          ? window.location.href
                          : null,
                      origin:
                        typeof window !== "undefined"
                          ? window.location.origin
                          : null,
                      host:
                        typeof window !== "undefined" ? window.location.host : null,
                      callbackUrl,
                    },
                    timestamp: Date.now(),
                  }),
                },
              ).catch(() => {});
            }
            // #endregion agent log

            void signIn("google", { callbackUrl });
          }}
          className="mt-6 w-full rounded-xl bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--accent-2)] px-4 py-3 text-sm font-semibold text-white shadow-[0_16px_34px_rgba(97,106,243,0.28)] hover:brightness-[1.02]"
        >
          Continue with Google
        </button>

        <p className="mt-4 text-xs text-[color:rgba(11,18,32,0.60)]">
          By continuing, you agree to our Terms and Privacy Policy (coming soon).
        </p>
      </div>
    </div>
  );
}



