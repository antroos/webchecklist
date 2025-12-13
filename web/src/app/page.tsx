import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-[color:var(--bg)] text-[color:var(--text)]">
      <header className="sticky top-0 z-50 border-b border-[color:rgba(15,23,42,0.06)] bg-[color:rgba(255,255,255,0.75)] backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <Link href="/" className="inline-flex items-center gap-2 font-semibold">
            <span className="h-7 w-7 rounded-lg bg-gradient-to-br from-[color:var(--accent)] to-[color:var(--accent-2)] shadow-[0_10px_25px_rgba(97,106,243,0.22)]" />
            <span>WebMorpher</span>
          </Link>
          <nav className="hidden items-center gap-4 text-sm font-medium text-[color:rgba(11,18,32,0.78)] md:flex">
            <a href="#problem" className="rounded-lg px-3 py-2 hover:bg-[color:rgba(97,106,243,0.08)]">
              Problem
            </a>
            <a href="#how" className="rounded-lg px-3 py-2 hover:bg-[color:rgba(97,106,243,0.08)]">
              How it works
            </a>
            <a href="#get" className="rounded-lg px-3 py-2 hover:bg-[color:rgba(97,106,243,0.08)]">
              What you get
            </a>
            <a href="#try" className="rounded-lg border border-[color:rgba(97,106,243,0.28)] bg-[color:rgba(97,106,243,0.12)] px-3 py-2 hover:bg-[color:rgba(97,106,243,0.16)]">
              Check my website
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/app"
              className="rounded-xl bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--accent-2)] px-4 py-2 text-sm font-semibold text-white shadow-[0_16px_34px_rgba(97,106,243,0.22)] hover:brightness-[1.02]"
            >
              Open app
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden px-6 pb-12 pt-16">
          <div className="pointer-events-none absolute inset-[-20%] opacity-70">
            <div className="absolute left-[10%] top-[10%] h-[420px] w-[420px] rounded-full bg-[color:rgba(97,106,243,0.18)] blur-[80px]" />
            <div className="absolute right-[5%] top-[5%] h-[520px] w-[520px] rounded-full bg-[color:rgba(139,92,246,0.14)] blur-[90px]" />
            <div className="absolute bottom-[0%] right-[25%] h-[520px] w-[520px] rounded-full bg-[color:rgba(16,185,129,0.08)] blur-[90px]" />
          </div>

          <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-start gap-10 md:grid-cols-2">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[color:rgba(15,23,42,0.08)] bg-[color:rgba(255,255,255,0.8)] px-3 py-2 text-xs font-semibold text-[color:rgba(11,18,32,0.72)] shadow-[0_10px_30px_rgba(2,6,23,0.06)]">
                Built alone? Make sure nothing is broken.
              </div>
              <h1 className="mt-4 text-balance text-4xl font-semibold leading-[1.05] tracking-[-0.02em] md:text-5xl">
                A second set of eyes for your website — when you don’t have a team.
              </h1>
              <p className="mt-4 max-w-[58ch] text-lg text-[color:rgba(11,18,32,0.78)]">
                WebMorpher reviews your page like a careful QA Lead would and generates a practical checklist of what to
                check.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href="#try"
                  className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--accent-2)] px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_34px_rgba(97,106,243,0.22)] hover:brightness-[1.02]"
                >
                  Check my website
                </a>
                <a
                  href="#get"
                  className="inline-flex items-center justify-center rounded-xl border border-[color:rgba(15,23,42,0.10)] bg-[color:rgba(255,255,255,0.85)] px-5 py-3 text-sm font-semibold text-[color:rgba(11,18,32,0.88)] shadow-[0_12px_28px_rgba(2,6,23,0.06)] hover:bg-[color:rgba(255,255,255,0.92)]"
                >
                  See what you get
                </a>
              </div>

              <ul className="mt-6 list-disc pl-5 text-sm font-semibold text-[color:rgba(11,18,32,0.70)]">
                <li>No setup</li>
                <li>No scripts</li>
                <li>No clicking through every page manually</li>
              </ul>
            </div>

            <div className="rounded-[var(--radius)] border border-[color:rgba(15,23,42,0.10)] bg-[color:rgba(255,255,255,0.78)] shadow-[var(--shadow)]">
              <div className="flex gap-2 px-4 pt-4">
                <span className="rounded-full border border-[color:rgba(97,106,243,0.22)] bg-[color:rgba(97,106,243,0.12)] px-3 py-1 text-xs font-semibold text-[color:rgba(11,18,32,0.84)]">
                  Output
                </span>
                <span className="rounded-full border border-[color:rgba(15,23,42,0.08)] bg-[color:rgba(15,23,42,0.05)] px-3 py-1 text-xs font-semibold text-[color:rgba(11,18,32,0.72)]">
                  Checklist
                </span>
                <span className="rounded-full border border-[color:rgba(15,23,42,0.08)] bg-[color:rgba(15,23,42,0.05)] px-3 py-1 text-xs font-semibold text-[color:rgba(11,18,32,0.72)]">
                  Risk areas
                </span>
              </div>
              <div className="grid gap-3 p-4">
                {[
                  {
                    t: "Translation coverage",
                    d: "Sections that often remain untranslated after edits.",
                    kind: "ok",
                  },
                  {
                    t: "Flow consistency",
                    d: "Critical blocks behaving differently across pages.",
                    kind: "warn",
                  },
                  {
                    t: "UI/content mismatches",
                    d: "Copy, spacing, and states that drift after refactors.",
                    kind: "warn",
                  },
                ].map((x) => (
                  <div
                    key={x.t}
                    className="grid grid-cols-[14px_1fr] gap-3 rounded-[var(--radius-sm)] border border-[color:rgba(15,23,42,0.08)] bg-[color:rgba(255,255,255,0.65)] p-3"
                  >
                    <span
                      className={`mt-1 h-2.5 w-2.5 rounded-full ${
                        x.kind === "ok"
                          ? "bg-[color:var(--ok)] shadow-[0_0_0_4px_rgba(16,185,129,0.14)]"
                          : "bg-[color:var(--warn)] shadow-[0_0_0_4px_rgba(245,158,11,0.14)]"
                      }`}
                    />
                    <div>
                      <div className="font-semibold text-[color:rgba(11,18,32,0.9)]">
                        {x.t}
                      </div>
                      <div className="mt-0.5 text-sm text-[color:rgba(11,18,32,0.68)]">
                        {x.d}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-[color:rgba(15,23,42,0.06)] bg-[color:rgba(255,255,255,0.6)] p-4 text-sm text-[color:rgba(11,18,32,0.68)]">
                A structured way to review your own work — like having calm, experienced eyes.
              </div>
            </div>
          </div>
        </section>

        <section id="problem" className="mx-auto w-full max-w-6xl px-6 py-14">
          <div className="max-w-3xl">
            <h2 className="text-3xl font-semibold tracking-[-0.02em]">The problem</h2>
            <p className="mt-3 text-[color:rgba(11,18,32,0.72)]">
              When you build a website alone, things break quietly. Nothing crashes. No errors show up. But later you
              notice:
            </p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              { h: "A section wasn’t translated", p: "New language added — and a few blocks stayed in the old one." },
              { h: "A flow feels inconsistent", p: "Buttons, pages, or states don’t match the path users actually take." },
              { h: "A critical block behaves differently", p: "After a refactor, one key component subtly changed across the site." },
            ].map((c) => (
              <div
                key={c.h}
                className="rounded-[var(--radius)] border border-[color:rgba(15,23,42,0.10)] bg-[color:rgba(255,255,255,0.9)] p-5 shadow-[var(--shadow-sm)]"
              >
                <h3 className="text-base font-semibold">{c.h}</h3>
                <p className="mt-2 text-sm text-[color:rgba(11,18,32,0.70)]">{c.p}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-[var(--radius)] border border-[color:rgba(15,23,42,0.10)] bg-[color:rgba(255,255,255,0.78)] p-5 text-[color:rgba(11,18,32,0.72)]">
            You didn’t miss it because you’re careless. You missed it because you can’t see everything at once.{" "}
            <span className="font-semibold text-[color:rgba(11,18,32,0.9)]">
              The hardest part isn’t fixing bugs. It’s knowing what to check.
            </span>
          </div>
        </section>

        <section id="how" className="border-y border-[color:rgba(15,23,42,0.04)] bg-[color:rgba(15,23,42,0.02)]">
          <div className="mx-auto w-full max-w-6xl px-6 py-14">
            <h2 className="text-3xl font-semibold tracking-[-0.02em]">How it works</h2>
            <ol className="mt-6 grid gap-3">
              {[
                { n: "1", t: "You paste a website URL", d: "No setup. No scripts. No repo access required." },
                { n: "2", t: "We analyze structure, content, and flows", d: "It looks at what users will likely do — not just what pages exist." },
                { n: "3", t: "You get a clear list of what to check", d: "A practical checklist + the places where issues like to hide." },
              ].map((s) => (
                <li
                  key={s.n}
                  className="grid grid-cols-[42px_1fr] gap-4 rounded-[var(--radius)] border border-[color:rgba(15,23,42,0.10)] bg-[color:rgba(255,255,255,0.78)] p-5 shadow-[var(--shadow-sm)]"
                >
                  <div className="grid h-10 w-10 place-items-center rounded-xl border border-[color:rgba(97,106,243,0.22)] bg-[color:rgba(97,106,243,0.12)] font-extrabold text-[color:rgba(11,18,32,0.92)]">
                    {s.n}
                  </div>
                  <div>
                    <div className="font-extrabold">{s.t}</div>
                    <div className="mt-1 text-sm text-[color:rgba(11,18,32,0.70)]">{s.d}</div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="get" className="mx-auto w-full max-w-6xl px-6 py-14">
          <h2 className="text-3xl font-semibold tracking-[-0.02em]">What you get</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {[
              { h: "Website understanding", items: ["What type of site this is (SaaS, landing page, e-commerce, etc.)"] },
              { h: "Key user flows", items: ["The paths real users are likely to take", "Where consistency matters most"] },
              { h: "Risk areas", items: ["Sections that often break after changes", "Language, content, and UI mismatches", "Areas that deserve extra attention"] },
              { h: "A practical checklist", items: ["Functional checks", "UI and content consistency", "UX edge cases", "Things easy to miss when working alone"] },
            ].map((c) => (
              <div
                key={c.h}
                className="rounded-[var(--radius)] border border-[color:rgba(15,23,42,0.10)] bg-[color:rgba(255,255,255,0.9)] p-5 shadow-[var(--shadow-sm)]"
              >
                <h3 className="text-base font-semibold">{c.h}</h3>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[color:rgba(11,18,32,0.70)]">
                  {c.items.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              </div>
            ))}
            <div className="rounded-[var(--radius)] border border-[color:rgba(15,23,42,0.10)] bg-gradient-to-b from-[color:rgba(97,106,243,0.08)] to-[color:rgba(139,92,246,0.06)] p-5 shadow-[var(--shadow-sm)]">
              <h3 className="text-base font-semibold">What this is not</h3>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[color:rgba(11,18,32,0.70)]">
                <li>Not a test runner</li>
                <li>Not an automation framework</li>
                <li>Not a replacement for QA</li>
                <li>It helps you notice what you might otherwise miss</li>
              </ul>
            </div>
          </div>
        </section>

        <section id="try" className="border-t border-[color:rgba(15,23,42,0.06)]">
          <div className="mx-auto w-full max-w-6xl px-6 py-14">
            <h2 className="text-3xl font-semibold tracking-[-0.02em]">Try it</h2>
            <p className="mt-2 text-[color:rgba(11,18,32,0.72)]">Sign in and analyze your first 5 pages for free.</p>
            <div className="mt-6 flex flex-col gap-3 rounded-[var(--radius)] border border-[color:rgba(15,23,42,0.10)] bg-[color:rgba(255,255,255,0.8)] p-5 shadow-[var(--shadow-sm)] md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-[color:rgba(11,18,32,0.78)]">
                You’ll get a CSV checklist + a JSON snapshot of the page structure.
              </div>
              <Link
                href="/app"
                className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--accent-2)] px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_34px_rgba(97,106,243,0.22)] hover:brightness-[1.02]"
              >
                Start (5 free)
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[color:rgba(15,23,42,0.06)]">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-8 text-sm text-[color:rgba(11,18,32,0.70)]">
          <div className="inline-flex items-center gap-2 font-semibold text-[color:rgba(11,18,32,0.88)]">
            <span className="h-6 w-6 rounded-lg bg-gradient-to-br from-[color:var(--accent)] to-[color:var(--accent-2)]" />
            WebMorpher
          </div>
          <a href="#top" className="hover:underline">
            Back to top
          </a>
        </div>
      </footer>
    </div>
  );
}


