import NextAuth from "next-auth";
import type { NextRequest } from "next/server";

import { authOptions } from "@/auth";

const handler = NextAuth(authOptions);

function logAuth(req: NextRequest, phase: string, params: unknown) {
  try {
    const cookie = req.headers.get("cookie") ?? "";
    const cookieKeys = cookie
      .split(";")
      .map((c) => c.trim().split("=")[0])
      .filter(Boolean)
      .slice(0, 60);

    const payload = {
      tag: "AUTHDBG",
      phase,
      path: req.nextUrl.pathname,
      host: req.headers.get("host"),
      forwardedHost: req.headers.get("x-forwarded-host"),
      forwardedProto: req.headers.get("x-forwarded-proto"),
      params: params ?? null,
      refererHost: (() => {
        const ref = req.headers.get("referer");
        try {
          return ref ? new URL(ref).host : null;
        } catch {
          return null;
        }
      })(),
      cookieKeyCount: cookieKeys.length,
      hasState: cookie.includes("next-auth.state"),
      hasCsrf:
        cookie.includes("next-auth.csrf-token") ||
        cookie.includes("__Host-next-auth.csrf-token"),
      hasCallbackUrl: cookie.includes("next-auth.callback-url"),
      hasSessionToken:
        cookie.includes("next-auth.session-token") ||
        cookie.includes("__Secure-next-auth.session-token"),
      ts: Date.now(),
    };
    // Cloud Run captures stdout/stderr into Logs Explorer.
    console.log(JSON.stringify(payload));
  } catch {
    // never break auth handler
  }
}

async function resolveParams(ctx: unknown): Promise<unknown> {
  const maybe = (ctx as any)?.params;
  if (maybe && typeof maybe.then === "function") {
    return await maybe;
  }
  return maybe ?? null;
}

export async function GET(req: NextRequest, ctx: unknown) {
  const params = await resolveParams(ctx);
  logAuth(req, "GET", params);
  return (handler as any)(req, ctx);
}

export async function POST(req: NextRequest, ctx: unknown) {
  const params = await resolveParams(ctx);
  logAuth(req, "POST", params);
  return (handler as any)(req, ctx);
}


