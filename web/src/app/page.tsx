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
            <a
              href="#how"
              className="rounded-lg px-3 py-2 hover:bg-[color:rgba(97,106,243,0.08)]"
            >
              How it works
            </a>
            <a
              href="#features"
              className="rounded-lg px-3 py-2 hover:bg-[color:rgba(97,106,243,0.08)]"
            >
              What you get
            </a>
            <a
              href="#use-cases"
              className="rounded-lg px-3 py-2 hover:bg-[color:rgba(97,106,243,0.08)]"
            >
              Use cases
            </a>
            <a
              href="#pricing"
              className="rounded-lg px-3 py-2 hover:bg-[color:rgba(97,106,243,0.08)]"
            >
              Pricing
            </a>
            <a
              href="#try"
              className="rounded-lg border border-[color:rgba(97,106,243,0.28)] bg-[color:rgba(97,106,243,0.12)] px-3 py-2 hover:bg-[color:rgba(97,106,243,0.16)]"
            >
              Try it
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
                Your calm AI mentor for building and scaling.
              </div>
              <h1 className="mt-4 text-balance text-4xl font-semibold leading-[1.05] tracking-[-0.02em] md:text-5xl">
                Build your business and improve your metrics with an AI mentor.
              </h1>
              <p className="mt-4 max-w-[58ch] text-lg text-[color:rgba(11,18,32,0.78)]">
                Get KPI-focused audits, actionable playbooks, and weekly execution — tailored to your business context.
                Start with a question or a URL.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href="#try"
                  className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--accent-2)] px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_34px_rgba(97,106,243,0.22)] hover:brightness-[1.02]"
                >
                  Try for free
                </a>
                <a
                  href="#how"
                  className="inline-flex items-center justify-center rounded-xl border border-[color:rgba(15,23,42,0.10)] bg-[color:rgba(255,255,255,0.85)] px-5 py-3 text-sm font-semibold text-[color:rgba(11,18,32,0.88)] shadow-[0_12px_28px_rgba(2,6,23,0.06)] hover:bg-[color:rgba(255,255,255,0.92)]"
                >
                  See how it works
                </a>
              </div>

              <div className="mt-7 grid gap-3 rounded-[var(--radius)] border border-[color:rgba(15,23,42,0.10)] bg-[color:rgba(255,255,255,0.78)] p-4 shadow-[var(--shadow-sm)]">
                <div className="text-xs font-semibold text-[color:rgba(11,18,32,0.72)]">
                  What you get in 60 seconds
                </div>
                <ul className="grid gap-1.5 text-sm text-[color:rgba(11,18,32,0.74)]">
                  {[
                    "A prioritized plan (what matters now vs later)",
                    "Key risks + assumptions to validate",
                    "Next 5 actions with effort estimates",
                    "Suggested KPI set to track progress",
                  ].map((t) => (
                    <li key={t} className="flex gap-2">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:rgba(97,106,243,0.70)]" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="rounded-[var(--radius)] border border-[color:rgba(15,23,42,0.10)] bg-[color:rgba(255,255,255,0.78)] shadow-[var(--shadow)]">
              <div className="flex gap-2 px-4 pt-4">
                <span className="rounded-full border border-[color:rgba(97,106,243,0.22)] bg-[color:rgba(97,106,243,0.12)] px-3 py-1 text-xs font-semibold text-[color:rgba(11,18,32,0.84)]">
                  Example output
                </span>
                <span className="rounded-full border border-[color:rgba(15,23,42,0.08)] bg-[color:rgba(15,23,42,0.05)] px-3 py-1 text-xs font-semibold text-[color:rgba(11,18,32,0.72)]">
                  Plan
                </span>
                <span className="rounded-full border border-[color:rgba(15,23,42,0.08)] bg-[color:rgba(15,23,42,0.05)] px-3 py-1 text-xs font-semibold text-[color:rgba(11,18,32,0.72)]">
                  Priorities
                </span>
              </div>
              <div className="grid gap-3 p-4">
                {[
                  {
                    t: "Goal & constraints",
                    d: "Define success, timeline, budget, and current bottlenecks.",
                    kind: "ok",
                  },
                  {
                    t: "Top 3 levers",
                    d: "The few changes most likely to move the KPI this week.",
                    kind: "warn",
                  },
                  {
                    t: "Next actions",
                    d: "A small checklist you can execute today.",
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
                Structured thinking, practical output, no fluff — like having an experienced mentor on call.
              </div>
            </div>
          </div>
        </section>

        <section id="how" className="border-y border-[color:rgba(15,23,42,0.04)] bg-[color:rgba(15,23,42,0.02)]">
          <div className="mx-auto w-full max-w-6xl px-6 py-14">
            <h2 className="text-3xl font-semibold tracking-[-0.02em]">How it works</h2>
            <p className="mt-3 max-w-3xl text-[color:rgba(11,18,32,0.72)]">
              Turn a business goal into a measurable plan — then execute weekly with clear checklists and reviews.
            </p>
            <ol className="mt-6 grid gap-3">
              {[
                { n: "1", t: "Set a goal", d: "Tell us what you’re trying to improve (activation, conversion, retention, revenue)." },
                { n: "2", t: "Add context", d: "Drop your current situation, constraints, and (optionally) a URL or screenshot." },
                { n: "3", t: "Get a plan & execute", d: "You get priorities + next actions. You run the week. Then we review and iterate." },
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
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <div className="rounded-[var(--radius)] border border-[color:rgba(15,23,42,0.10)] bg-[color:rgba(255,255,255,0.78)] p-5 shadow-[var(--shadow-sm)]">
                <div className="text-sm font-semibold">See how it works in under 5 minutes</div>
                <div className="mt-2 text-sm text-[color:rgba(11,18,32,0.70)]">
                  Add a short Loom or product demo here later. For now, the app is ready to use.
                </div>
                <div className="mt-4 rounded-2xl border border-[color:rgba(15,23,42,0.10)] bg-[color:rgba(15,23,42,0.03)] p-4 text-sm text-[color:rgba(11,18,32,0.72)]">
                  Demo placeholder
                </div>
              </div>
              <div className="rounded-[var(--radius)] border border-[color:rgba(15,23,42,0.10)] bg-[color:rgba(255,255,255,0.78)] p-5 shadow-[var(--shadow-sm)]">
                <div className="text-sm font-semibold">Improve the metrics that matter</div>
                <div className="mt-2 text-sm text-[color:rgba(11,18,32,0.70)]">
                  One week at a time: clarity → plan → execution → review.
                </div>
                <div className="mt-4 grid gap-3">
                  {[
                    { h: "Clarity", p: "Define goal, constraints, and KPI targets." },
                    { h: "Plan", p: "Prioritized roadmap + experiments." },
                    { h: "Execution", p: "Weekly checklists and reviews." },
                  ].map((x) => (
                    <div
                      key={x.h}
                      className="rounded-2xl border border-[color:rgba(15,23,42,0.08)] bg-white/70 p-4"
                    >
                      <div className="font-semibold">{x.h}</div>
                      <div className="mt-1 text-sm text-[color:rgba(11,18,32,0.70)]">{x.p}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 py-14">
          <h2 className="text-3xl font-semibold tracking-[-0.02em]">AI mentor vs. expensive consultants</h2>
          <p className="mt-3 max-w-3xl text-[color:rgba(11,18,32,0.72)]">
            Same principles, less waiting. Get help when you need it — and keep your process consistent.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-[var(--radius)] border border-[color:rgba(15,23,42,0.10)] bg-[color:rgba(255,255,255,0.9)] p-6 shadow-[var(--shadow-sm)]">
              <div className="text-sm font-semibold text-[color:rgba(11,18,32,0.78)]">AI mentor</div>
              <ul className="mt-4 grid gap-2 text-sm text-[color:rgba(11,18,32,0.72)]">
                {[
                  "Available 24/7",
                  "Minutes to a first plan",
                  "Consistent frameworks & checklists",
                  "Works across product, growth, ops",
                ].map((t) => (
                  <li key={t} className="flex gap-2">
                    <span className="mt-1.5 h-2 w-2 rounded-full bg-[color:rgba(16,185,129,0.70)]" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-[var(--radius)] border border-[color:rgba(15,23,42,0.10)] bg-[color:rgba(255,255,255,0.78)] p-6 shadow-[var(--shadow-sm)]">
              <div className="text-sm font-semibold text-[color:rgba(11,18,32,0.78)]">Traditional consulting</div>
              <ul className="mt-4 grid gap-2 text-sm text-[color:rgba(11,18,32,0.72)]">
                {[
                  "Weeks to get started",
                  "High cost per hour",
                  "Quality varies by person",
                  "Hard to keep a weekly cadence",
                ].map((t) => (
                  <li key={t} className="flex gap-2">
                    <span className="mt-1.5 h-2 w-2 rounded-full bg-[color:rgba(245,158,11,0.70)]" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section
          id="features"
          className="border-y border-[color:rgba(15,23,42,0.04)] bg-[color:rgba(15,23,42,0.02)]"
        >
          <div className="mx-auto w-full max-w-6xl px-6 py-14">
            <h2 className="text-3xl font-semibold tracking-[-0.02em]">Everything you need to build and grow</h2>
            <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[
                { h: "KPI audit", p: "Why metrics are stuck + what to change first." },
                { h: "UI/UX review", p: "Conversion and usability improvements with priorities." },
                { h: "QA checklist", p: "Practical test checklist for releases and flows." },
                { h: "Funnel & growth", p: "Acquisition → activation → retention experiments." },
                { h: "Pricing & packaging", p: "Offer structure, tiers, positioning." },
                { h: "Weekly operating system", p: "Plan → tasks → review → next iteration." },
              ].map((c) => (
                <div
                  key={c.h}
                  className="rounded-[var(--radius)] border border-[color:rgba(15,23,42,0.10)] bg-white/85 p-6 shadow-[var(--shadow-sm)]"
                >
                  <h3 className="text-base font-semibold">{c.h}</h3>
                  <p className="mt-2 text-sm text-[color:rgba(11,18,32,0.70)]">{c.p}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="use-cases" className="mx-auto w-full max-w-6xl px-6 py-14">
          <h2 className="text-3xl font-semibold tracking-[-0.02em]">Built for every business function</h2>
          <p className="mt-3 max-w-3xl text-[color:rgba(11,18,32,0.72)]">
            Use it as a mentor across product, marketing, sales, success, and operations.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[
              { h: "Product", p: "Roadmap, prioritization, churn analysis." },
              { h: "Marketing", p: "Landing audit, messaging, SEO ideas." },
              { h: "Sales", p: "ICP, objections, outreach sequences." },
              { h: "Customer Success", p: "Onboarding, retention playbooks." },
              { h: "Operations", p: "SOPs, automation, hiring scorecards." },
              { h: "Strategy", p: "Positioning, differentiation, moat hypotheses." },
            ].map((c) => (
              <div
                key={c.h}
                className="rounded-[var(--radius)] border border-[color:rgba(15,23,42,0.10)] bg-[color:rgba(255,255,255,0.9)] p-6 shadow-[var(--shadow-sm)]"
              >
                <h3 className="text-base font-semibold">{c.h}</h3>
                <p className="mt-2 text-sm text-[color:rgba(11,18,32,0.70)]">{c.p}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-[var(--radius)] border border-[color:rgba(15,23,42,0.10)] bg-[color:rgba(255,255,255,0.78)] p-5 text-sm text-[color:rgba(11,18,32,0.72)]">
            Missing a workflow? Create your own “mode” with a per‑project system prompt.
          </div>
        </section>

        <section id="pricing" className="border-y border-[color:rgba(15,23,42,0.04)] bg-[color:rgba(15,23,42,0.02)]">
          <div className="mx-auto w-full max-w-6xl px-6 py-14">
            <h2 className="text-3xl font-semibold tracking-[-0.02em]">Start free, upgrade when you’re ready</h2>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {[
                {
                  h: "Free",
                  p: "Try it and feel the workflow.",
                  items: ["Limited messages", "1 project", "Core prompts"],
                },
                {
                  h: "Pro",
                  p: "For builders who ship weekly.",
                  items: ["Unlimited chat", "Saved projects", "Templates & modes"],
                  highlight: true,
                },
                {
                  h: "Team (later)",
                  p: "For teams collaborating on execution.",
                  items: ["Shared projects", "Roles & access", "Usage controls"],
                },
              ].map((c) => (
                <div
                  key={c.h}
                  className={`rounded-[var(--radius)] border p-6 shadow-[var(--shadow-sm)] ${
                    c.highlight
                      ? "border-[color:rgba(97,106,243,0.28)] bg-white"
                      : "border-[color:rgba(15,23,42,0.10)] bg-white/80"
                  }`}
                >
                  <div className="text-lg font-semibold">{c.h}</div>
                  <div className="mt-2 text-sm text-[color:rgba(11,18,32,0.70)]">{c.p}</div>
                  <ul className="mt-4 grid gap-2 text-sm text-[color:rgba(11,18,32,0.72)]">
                    {c.items.map((t) => (
                      <li key={t} className="flex gap-2">
                        <span className="mt-1.5 h-2 w-2 rounded-full bg-[color:rgba(97,106,243,0.70)]" />
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="mx-auto w-full max-w-6xl px-6 py-14">
          <h2 className="text-3xl font-semibold tracking-[-0.02em]">FAQ</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {[
              {
                q: "What is an AI business mentor?",
                a: "A guided way to turn goals into prioritized actions and run weekly iterations using proven frameworks.",
              },
              {
                q: "How is it different from ChatGPT?",
                a: "It’s built around projects, modes, and structured outputs (plans, checklists, audits) — not random conversation.",
              },
              {
                q: "Can I add my business context?",
                a: "Yes. Each chat can have its own system prompt (your project context) so answers stay consistent.",
              },
              {
                q: "Is it private?",
                a: "You control what you share. Don’t paste sensitive data you wouldn’t want in an AI system.",
              },
            ].map((x) => (
              <div
                key={x.q}
                className="rounded-[var(--radius)] border border-[color:rgba(15,23,42,0.10)] bg-[color:rgba(255,255,255,0.9)] p-6 shadow-[var(--shadow-sm)]"
              >
                <div className="font-semibold">{x.q}</div>
                <div className="mt-2 text-sm text-[color:rgba(11,18,32,0.70)]">{x.a}</div>
              </div>
            ))}
          </div>
        </section>

        <section id="try" className="border-t border-[color:rgba(15,23,42,0.06)]">
          <div className="mx-auto w-full max-w-6xl px-6 py-14">
            <h2 className="text-3xl font-semibold tracking-[-0.02em]">Try it</h2>
            <p className="mt-2 text-[color:rgba(11,18,32,0.72)]">
              Open the app, start a chat, and ask for an audit, a plan, or next steps. Works on mobile too.
            </p>
            <div className="mt-6 flex flex-col gap-3 rounded-[var(--radius)] border border-[color:rgba(15,23,42,0.10)] bg-[color:rgba(255,255,255,0.8)] p-5 shadow-[var(--shadow-sm)] md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-[color:rgba(11,18,32,0.78)]">
                Start with “UI/UX audit”, “QA checklist”, or “Make me a weekly plan for X”.
              </div>
              <Link
                href="/app"
                className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--accent-2)] px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_34px_rgba(97,106,243,0.22)] hover:brightness-[1.02]"
              >
                Open app
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
          <a href="#how" className="hover:underline">
            Back to top
          </a>
        </div>
      </footer>
    </div>
  );
}


