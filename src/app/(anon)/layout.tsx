import { auth } from "torneos/server/auth";
import { AppShell } from "torneos/components/ui/app-shell/app-shell";
import { BottomNav } from "torneos/components/ui/bottom-nav/bottom-nav";
import { isOnboarded } from "torneos/lib/session";

/**
 * Vitrina. Chrome por sesión: anónimo navega sin nav; el público que cae
 * aquí (hub, canchas, torneos) conserva su BottomNav — misma URL `/`,
 * distinto chrome.
 */
export default async function AnonLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const showAppNav = isOnboarded(session);

  return (
    <AppShell>
      {children}
      {showAppNav && <BottomNav />}
    </AppShell>
  );
}