"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

export default function SignInPage() {
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") || "/app";

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
          onClick={() => signIn("google", { callbackUrl })}
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


