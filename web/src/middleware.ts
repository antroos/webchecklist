import { NextResponse, type NextRequest } from "next/server";

/**
 * Force HTTPS when running behind a proxy (Cloud Run / load balancer).
 * Cloud Run typically already redirects http->https, but this adds an app-level safety net.
 */
export function middleware(req: NextRequest) {
  // Only enforce in production to avoid surprising local dev behavior.
  if (process.env.NODE_ENV !== "production") {
    return NextResponse.next();
  }

  // Enforce a canonical host so NextAuth cookies/state don't split across
  // multiple Cloud Run URLs (e.g. project-number run.app vs service a.run.app).
  // This is critical for OAuth flows; otherwise the first login can fail and the
  // second succeeds due to cookies being on different hosts.
  const configured = process.env.NEXTAUTH_URL;
  if (configured) {
    try {
      const canonicalHost = new URL(configured).host;
      const reqHost =
        req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
      if (canonicalHost && reqHost && canonicalHost !== reqHost) {
        const url = req.nextUrl.clone();
        url.host = canonicalHost;
        // Keep protocol aligned with the configured URL.
        url.protocol = new URL(configured).protocol;
        return NextResponse.redirect(url, 308);
      }
    } catch {
      // ignore invalid NEXTAUTH_URL
    }
  }

  const forwardedProto = req.headers.get("x-forwarded-proto");
  if (forwardedProto === "http") {
    const url = req.nextUrl.clone();
    url.protocol = "https:";
    return NextResponse.redirect(url, 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};


