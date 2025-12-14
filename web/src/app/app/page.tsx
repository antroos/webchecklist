import { redirect } from "next/navigation";

import { auth } from "@/auth";
import AppClient from "./AppClient";

export default async function AppPage({
  searchParams,
}: {
  searchParams?: { chatId?: string };
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/auth/signin?callbackUrl=/app");
  }
  const chatId =
    typeof searchParams?.chatId === "string" && searchParams.chatId.trim()
      ? searchParams.chatId
      : null;
  return <AppClient chatId={chatId} />;
}


