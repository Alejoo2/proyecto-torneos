import { auth } from "torneos/server/auth";
import { AppShell } from "torneos/components/ui/app-shell/app-shell";
import { BottomNav } from "torneos/components/ui/bottom-nav/bottom-nav";
import { isOnboarded } from "torneos/lib/session";

/**
 * Zona autenticada. El middleware garantiza sesión aquí; el único path de un
 * usuario !onboarded es /onboarding, y ese no recibe BottomNav (no navega
 * Equipo/Perfil antes de completar el alta).
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <AppShell>
      {children}
      {isOnboarded(session) && <BottomNav />}
    </AppShell>
  );
}