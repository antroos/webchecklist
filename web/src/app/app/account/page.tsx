import AccountClient from "./ui/AccountClient";
import { auth } from "@/auth";

export default async function AccountPage() {
  const session = await auth();
  const user = session?.user as { name?: string | null; email?: string | null } | undefined;

  return <AccountClient name={user?.name ?? null} email={user?.email ?? null} />;
}



