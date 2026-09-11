import { redirect } from "next/navigation";
import { auth } from "torneos/server/auth";
import { LoginForm } from "torneos/components/features/auth/login-form";
import {
  isSafeInternalPath,
  DEFAULT_AUTHENTICATED_PATH,
} from "torneos/lib/anon-access";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { callbackUrl?: string };
}) {
  const session = await auth();

  if (session?.user) {
    // Paridad con el middleware: sin onboarding no hay callback ni hub
    const user = session.user as { onboarded?: boolean } | undefined;
    if (!user?.onboarded) redirect("/onboarding");

    const requested = searchParams.callbackUrl;
    redirect(isSafeInternalPath(requested) ? requested : DEFAULT_AUTHENTICATED_PATH);
  }

  return <LoginForm />;
}