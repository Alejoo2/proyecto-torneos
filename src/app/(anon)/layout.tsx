import { auth } from "torneos/server/auth";
import { AppShell } from "torneos/components/app-shell/app-shell";
import { AppHeader } from "torneos/components/app-shell/app-header";
import { BottomNav } from "torneos/components/app-shell/bottom-nav";
import { HeaderTitleProvider } from "torneos/components/app-shell/header-title";
import { NotificationCenter } from "torneos/components/app-shell/notification-center";
import { isAdminSession, isOnboarded } from "torneos/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const isAdmin = await isAdminSession(session);

  return (
    <AppShell>
      <NotificationCenter>
        <HeaderTitleProvider>
          <AppHeader />
          <main className="relative flex-1 overflow-y-auto overscroll-contain">{children}</main>
        </HeaderTitleProvider>
      </NotificationCenter>
      {/* N-1: el link de Admin se decide SOLO aquí (RBAC server-side) */}
      {isOnboarded(session) && <BottomNav adminHref={isAdmin ? "/admin" : undefined} />}
    </AppShell>
  );
}