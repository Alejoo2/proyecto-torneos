import type { Session } from "next-auth";

/**
 * Claim `onboarded` viaja en la sesión (lo sube el callback de session);
 * no está en el tipo base de User, de ahí el cast único y centralizado.
 */
export function isOnboarded(session: Session | null): boolean {
  const user = session?.user as { onboarded?: boolean } | undefined;
  return !!user?.onboarded;
}