"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useSession } from "next-auth/react";
import { signOut } from "next-auth/react";
import { api } from "torneos/trpc/react";
import { NotificationBell } from "torneos/components/app-shell/notification-bell";
import { NotificationPanel } from "torneos/components/app-shell/notification-panel";

interface NotificationCenterValue {
  unread: number;
  openPanel: () => void;
  closePanel: () => void;
}

const NotificationCenterContext = createContext<NotificationCenterValue | null>(null);

/** Hook para triggers de campana fuera del header (ej: search bar del hub). */
export function useNotificationCenter(): NotificationCenterValue {
  const ctx = useContext(NotificationCenterContext);
  if (!ctx) throw new Error("useNotificationCenter fuera del provider");
  return ctx;
}

interface NotificationCenterProps {
  children: ReactNode;
}

/**
 * Estado único del panel de notificaciones (doc 3.4). El provider vive en el
 * shell; cualquier trigger (header, search del hub) consume el contexto.
 * Conectado a tRPC con polling para el conteo de no leídas (solo usuarios autenticados).
 */
export function NotificationCenter({ children }: NotificationCenterProps) {
  const [open, setOpen] = useState(false);
  const { data: session } = useSession();
  const isAuthenticated = Boolean(session?.user);
  const utils = api.useUtils();

  // 1. Polling cada 30s del conteo de no leídas SOLO si hay sesión activa
  const { data: unreadCount = 0 } = api.notification.unreadCount.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 30000,
    retry: false,
  });

  // 2. Consulta de notificaciones (solo cuando el panel está abierto Y hay sesión)
  const { data: notifications = [], isLoading } = api.notification.list.useQuery(undefined, {
    enabled: isAuthenticated && open,
    retry: false,
  });

  // 3. Mutaciones para marcar como leídas
  const markAsReadMutation = api.notification.markAsRead.useMutation({
    onSuccess: () => {
      void utils.notification.unreadCount.invalidate();
      void utils.notification.list.invalidate();
    },
  });

  const markAllAsReadMutation = api.notification.markAllAsRead.useMutation({
    onSuccess: () => {
      void utils.notification.unreadCount.invalidate();
      void utils.notification.list.invalidate();
    },
  });

  const handleItemRead = (id: string) => {
    const item = notifications.find((n) => n.id === id);
    if (item?.status === "UNREAD") {
      markAsReadMutation.mutate({ id });
    }
  };

  const handleMarkAllRead = () => {
    markAllAsReadMutation.mutate();
  };

  // N-2: salida universal de la app (sirve también en (admin)/W10, donde no hay nav)
  const handleLogout = () => {
    setOpen(false);
    void signOut({ redirectTo: "/" });
  };

  const value = useMemo(
    () => ({
      unread: isAuthenticated ? unreadCount : 0,
      openPanel: () => setOpen(true),
      closePanel: () => setOpen(false),
    }),
    [isAuthenticated, unreadCount],
  );

  return (
    <NotificationCenterContext.Provider value={value}>
      {children}
      {isAuthenticated && (
        <NotificationPanel
          open={open}
          onClose={() => setOpen(false)}
          items={notifications}
          isLoading={isLoading}
          onItemRead={handleItemRead}
          onMarkAllRead={handleMarkAllRead}
          onLogout={handleLogout}
        />
      )}
    </NotificationCenterContext.Provider>
  );
}

/** Trigger estándar: la campana con su badge. Reutilizable en header y hub. */
export function BellTrigger() {
  const { unread, openPanel } = useNotificationCenter();
  return <NotificationBell count={unread} onClick={openPanel} />;
}