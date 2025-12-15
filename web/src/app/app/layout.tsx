import { Suspense } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/auth/signin?callbackUrl=/app");
  }

  return (
    <div className="h-screen overflow-hidden bg-[color:var(--bg)] text-[color:var(--text)]">
      <div className="mx-auto flex h-full w-full max-w-6xl gap-4 px-4 py-6">
        <Suspense fallback={null}>
          <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {children}
          </main>
        </Suspense>
      </div>
    </div>
  );
}



