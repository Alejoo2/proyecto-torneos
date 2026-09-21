import { redirect } from "next/navigation";
import { auth } from "torneos/server/auth";
import { LoginForm } from "torneos/components/features/auth/login-form";
import {
  isSafeInternalPath,
  DEFAULT_AUTHENTICATED_PATH,
} from "torneos/lib/anon-access";

// Códigos estándar de NextAuth v5 — mensajes honestos, sin culpar al usuario.
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  OAuthSignin: "No se pudo iniciar el acceso con el proveedor. Intenta de nuevo.",
  OAuthCallback: "El proveedor devolvió un error. Intenta de nuevo.",
  OAuthAccountNotLinked:
    "Ese correo ya está asociado a otro acceso. Usa el proveedor con el que te registraste.",
  default: "No se pudo iniciar sesión. Intenta de nuevo.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;

  if (session?.user) {
    // Paridad con el middleware: sin onboarding no hay callback ni hub
    const user = session.user as { onboarded?: boolean } | undefined;
    if (!user?.onboarded) redirect("/onboarding");

    const requested = params.callbackUrl;
    redirect(isSafeInternalPath(requested) ? requested : DEFAULT_AUTHENTICATED_PATH);
  }

  const authError = params.error
    ? (AUTH_ERROR_MESSAGES[params.error] ?? AUTH_ERROR_MESSAGES.default)
    : undefined;

  return <LoginForm authError={authError} />;
}