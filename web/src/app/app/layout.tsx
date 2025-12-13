import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import SidebarNav from "./sidebar/SidebarNav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/auth/signin?callbackUrl=/app");
  }

  const user = session.user as { name?: string | null; email?: string | null };

  return (
    <div className="min-h-screen bg-[color:var(--bg)] text-[color:var(--text)]">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl gap-4 px-4 py-6">
        <aside className="hidden w-60 shrink-0 md:block">
          <div className="rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--card)] p-4 shadow-[var(--shadow)]">
            <Link href="/app" className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-2xl bg-gradient-to-br from-[color:var(--accent)] to-[color:var(--accent-2)] shadow-[0_16px_34px_rgba(97,106,243,0.18)]" />
              <div>
                <div className="text-sm font-semibold leading-4">WebMorpher</div>
                <div className="text-[11px] text-[color:rgba(11,18,32,0.60)]">
                  QA checklist
                </div>
              </div>
            </Link>

            <div className="mt-4">
              <SidebarNav />
            </div>

            <div className="mt-4 rounded-xl border border-[color:rgba(15,23,42,0.10)] bg-[color:rgba(15,23,42,0.02)] p-3">
              <div className="text-xs font-semibold text-[color:rgba(11,18,32,0.78)]">
                Signed in
              </div>
              <div className="mt-1 text-xs text-[color:rgba(11,18,32,0.62)]">
                {user.email || user.name || "User"}
              </div>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}



