import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { auth } from "@/auth";
import AppClient from "./AppClient";

export default async function AppPage() {
  try {
    const h = await headers();
    console.log(
      JSON.stringify({
        tag: "AUTHDBG",
        phase: "APP_PAGE",
        host: h.get("host"),
        forwardedHost: h.get("x-forwarded-host"),
        forwardedProto: h.get("x-forwarded-proto"),
        ts: Date.now(),
      }),
    );
  } catch {
    // ignore
  }

  const session = await auth();
  if (!session?.user) {
    console.log(
      JSON.stringify({
        tag: "AUTHDBG",
        phase: "APP_REDIRECT_SIGNIN",
        hasSessionUser: false,
        ts: Date.now(),
      }),
    );
    redirect("/auth/signin?callbackUrl=/app");
  }
  console.log(
    JSON.stringify({
      tag: "AUTHDBG",
      phase: "APP_SESSION_OK",
      hasSessionUser: true,
      ts: Date.now(),
    }),
  );
  return <AppClient />;
}


