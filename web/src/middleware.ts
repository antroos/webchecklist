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


