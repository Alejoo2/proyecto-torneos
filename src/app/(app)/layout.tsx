import { auth } from "torneos/server/auth";
import { AppShell } from "torneos/components/app-shell/app-shell";
import { AppHeader } from "torneos/components/app-shell/app-header";
import { BottomNav } from "torneos/components/app-shell/bottom-nav";
import { NotificationCenter } from "torneos/components/app-shell/notification-center";
import { isOnboarded } from "torneos/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <AppShell>
      <NotificationCenter>
        <AppHeader />
        <main className="relative flex-1 overflow-y-auto overscroll-contain">{children}</main>
      </NotificationCenter>
      {isOnboarded(session) && <BottomNav />}
    </AppShell>
  );
}