import { redirect } from "next/navigation";

import { auth } from "@/auth";
import AppClient from "./AppClient";

export default async function AppPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/auth/signin?callbackUrl=/app");
  }
  return <AppClient />;
}


