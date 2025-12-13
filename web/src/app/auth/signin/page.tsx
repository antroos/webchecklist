import SignInClient from "./SignInClient";

export default function SignInPage({
  searchParams,
}: {
  searchParams?: { callbackUrl?: string };
}) {
  const callbackUrl =
    typeof searchParams?.callbackUrl === "string" && searchParams.callbackUrl.trim()
      ? searchParams.callbackUrl
      : "/app";

  return <SignInClient callbackUrl={callbackUrl} />;
}


