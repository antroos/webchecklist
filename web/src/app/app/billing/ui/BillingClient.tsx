"use client";

import { useEffect, useMemo, useState } from "react";

type BillingStatus = {
  plan: "starter" | "pro" | null;
  includedMonthlyLimit: number;
  periodIncludedUsed: number;
  includedRemaining: number;
  periodEnd: any;
  overageUnitPriceCents: number;
  overageLimitCents: number;
  overageLimitDollars: number;
  overageUnlockedUntilPeriodEnd: boolean;
  overageSpentDollars: number;
};

function centsToDollars(cents: number) {
  return Math.round(cents) / 100;
}

export default function BillingClient() {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [checkingOut, setCheckingOut] = useState<"starter" | "pro" | null>(null);

  const [overageLimitDollars, setOverageLimitDollars] = useState<string>("10");

  const title = useMemo(() => {
    if (!status?.plan) return "No active plan";
    return status.plan === "starter" ? "Starter" : "Pro";
  }, [status?.plan]);

  async function refresh() {
    setError(null);
    const res = await fetch("/api/billing/status");
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`Failed to load billing: ${res.status} ${t}`);
    }
    const data = (await res.json()) as BillingStatus;
    setStatus(data);
    setOverageLimitDollars(String(data.overageLimitDollars ?? 10));
  }

  useEffect(() => {
    void refresh().catch((e) => setError(e instanceof Error ? e.message : "Load error"));
  }, []);

  async function startCheckout(plan: "starter" | "pro") {
    setError(null);
    setCheckingOut(plan);
    try {
      const res = await fetch(`/api/billing/checkout?plan=${plan}`, { method: "POST" });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`Checkout failed: HTTP ${res.status} ${t}`);
      }
      const data = (await res.json()) as { url?: string };
      if (!data.url) throw new Error("Checkout failed: missing redirect URL");
      window.location.assign(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout error");
    } finally {
      setCheckingOut(null);
    }
  }

  async function saveLimit() {
    setError(null);
    setSaving(true);
    try {
      const n = Number(overageLimitDollars);
      if (!Number.isFinite(n) || n < 0) throw new Error("Invalid limit");
      const res = await fetch("/api/billing/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overageLimitDollars: n }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`Save failed: HTTP ${res.status} ${t}`);
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <header className="rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--card)] p-4 shadow-[var(--shadow)]">
        <div className="text-xs font-semibold uppercase tracking-wide text-[color:rgba(11,18,32,0.60)]">
          Billing
        </div>
        <div className="mt-1 text-lg font-semibold">{title}</div>
        {status && status.plan && (
          <div className="mt-2 text-sm text-[color:rgba(11,18,32,0.72)]">
            Included: <span className="font-semibold">{status.includedMonthlyLimit}</span> / month.{" "}
            Used: <span className="font-semibold">{status.periodIncludedUsed}</span>. Remaining:{" "}
            <span className="font-semibold">{status.includedRemaining}</span>.
          </div>
        )}
      </header>

      {error && (
        <div className="rounded-lg border border-[color:rgba(239,68,68,0.25)] bg-[color:rgba(239,68,68,0.08)] px-3 py-2 text-sm text-[color:rgba(185,28,28,0.95)]">
          {error}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--card)] p-4 shadow-[var(--shadow)]">
          <div className="text-sm font-semibold">Starter</div>
          <div className="mt-1 text-sm text-[color:rgba(11,18,32,0.72)]">$9 / month</div>
          <div className="mt-2 text-sm text-[color:rgba(11,18,32,0.72)]">
            Includes <span className="font-semibold">50</span> analyses/month.
          </div>
          <button
            onClick={() => startCheckout("starter")}
            disabled={checkingOut !== null}
            className="mt-4 h-10 w-full rounded-xl bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--accent-2)] px-4 text-sm font-semibold text-white shadow-[0_16px_34px_rgba(97,106,243,0.22)] hover:brightness-[1.02] disabled:opacity-60"
          >
            {checkingOut === "starter" ? "Redirecting..." : "Choose Starter"}
          </button>
        </div>

        <div className="rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--card)] p-4 shadow-[var(--shadow)]">
          <div className="text-sm font-semibold">Pro</div>
          <div className="mt-1 text-sm text-[color:rgba(11,18,32,0.72)]">$29 / month</div>
          <div className="mt-2 text-sm text-[color:rgba(11,18,32,0.72)]">
            Includes <span className="font-semibold">200</span> analyses/month.
          </div>
          <button
            onClick={() => startCheckout("pro")}
            disabled={checkingOut !== null}
            className="mt-4 h-10 w-full rounded-xl bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--accent-2)] px-4 text-sm font-semibold text-white shadow-[0_16px_34px_rgba(97,106,243,0.22)] hover:brightness-[1.02] disabled:opacity-60"
          >
            {checkingOut === "pro" ? "Redirecting..." : "Choose Pro"}
          </button>
        </div>
      </div>

      <div className="rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--card)] p-4 shadow-[var(--shadow)]">
        <div className="text-sm font-semibold">Overage</div>
        <div className="mt-1 text-sm text-[color:rgba(11,18,32,0.72)]">
          After included quota:{" "}
          <span className="font-semibold">
            ${centsToDollars(status?.overageUnitPriceCents ?? 40).toFixed(2)}
          </span>{" "}
          per analysis.
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div>
            <div className="text-xs font-semibold text-[color:rgba(11,18,32,0.70)]">
              Monthly overage limit (default $10)
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm text-[color:rgba(11,18,32,0.72)]">$</span>
              <input
                value={overageLimitDollars}
                onChange={(e) => setOverageLimitDollars(e.target.value)}
                inputMode="decimal"
                className="h-10 w-40 rounded-xl border border-[color:rgba(15,23,42,0.12)] bg-[color:rgba(255,255,255,0.95)] px-3 text-sm text-[color:rgba(11,18,32,0.92)] outline-none focus:border-[color:rgba(97,106,243,0.55)] focus:shadow-[0_0_0_4px_rgba(97,106,243,0.14)]"
              />
              <button
                onClick={saveLimit}
                disabled={saving}
                className="h-10 rounded-xl border border-[color:rgba(15,23,42,0.12)] bg-[color:rgba(255,255,255,0.85)] px-4 text-sm font-semibold text-[color:rgba(11,18,32,0.84)] hover:bg-[color:rgba(255,255,255,0.95)] disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-[color:rgba(15,23,42,0.10)] bg-[color:rgba(15,23,42,0.02)] p-3">
            <div className="text-xs font-semibold text-[color:rgba(11,18,32,0.78)]">
              Current period
            </div>
            <div className="mt-1 text-sm text-[color:rgba(11,18,32,0.72)]">
              Overage spend (incl. in-flight):{" "}
              <span className="font-semibold">
                ${Number(status?.overageSpentDollars ?? 0).toFixed(2)}
              </span>
            </div>
            <div className="mt-1 text-xs text-[color:rgba(11,18,32,0.60)]">
              {status?.overageUnlockedUntilPeriodEnd
                ? "Overage is unlocked until period end."
                : "Overage requires confirmation when exceeding your limit."}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}



