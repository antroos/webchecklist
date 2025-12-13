import NextAuth from "next-auth";
import type { NextRequest } from "next/server";

import { authOptions } from "@/auth";

const handler = NextAuth(authOptions);

function logAuth(req: NextRequest, phase: string, ctx: unknown) {
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
      params: (ctx as any)?.params ?? null,
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

export function GET(req: NextRequest, ctx: unknown) {
  logAuth(req, "GET", ctx);
  return (handler as any)(req, ctx);
}

export function POST(req: NextRequest, ctx: unknown) {
  logAuth(req, "POST", ctx);
  return (handler as any)(req, ctx);
}


