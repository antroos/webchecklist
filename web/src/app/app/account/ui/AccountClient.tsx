"use client";

import { signOut } from "next-auth/react";

export default function AccountClient({
  name,
  email,
}: {
  name: string | null;
  email: string | null;
}) {
  return (
    <div className="space-y-4">
      <header className="rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--card)] p-4 shadow-[var(--shadow)]">
        <div className="text-xs font-semibold uppercase tracking-wide text-[color:rgba(11,18,32,0.60)]">
          Account
        </div>
        <div className="mt-1 text-lg font-semibold">{name || email || "User"}</div>
        {email && (
          <div className="mt-1 text-sm text-[color:rgba(11,18,32,0.70)]">{email}</div>
        )}
      </header>

      <div className="rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--card)] p-4 shadow-[var(--shadow)]">
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="h-10 rounded-xl border border-[color:rgba(15,23,42,0.12)] bg-[color:rgba(255,255,255,0.85)] px-4 text-sm font-semibold text-[color:rgba(11,18,32,0.84)] hover:bg-[color:rgba(255,255,255,0.95)]"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}


