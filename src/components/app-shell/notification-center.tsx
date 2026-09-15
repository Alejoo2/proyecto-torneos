"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { NotificationBell } from "torneos/components/app-shell/notification-bell";
import { NotificationPanel } from "torneos/components/app-shell/notification-panel";
import type { NotificationData } from "torneos/components/features/notifications/notification-item";

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
  notifications?: NotificationData[];
}

/**
 * Estado único del panel de notificaciones (doc 3.4). El provider vive en el
 * shell; cualquier trigger (header, search del hub) consume el contexto.
 * En producción las notificaciones llegan del polling del badge (9.2).
 */
export function NotificationCenter({ children, notifications = [] }: NotificationCenterProps) {
  const [open, setOpen] = useState(false);
  const unread = notifications.filter((n) => !n.read).length;

  const value = useMemo(
    () => ({ unread, openPanel: () => setOpen(true), closePanel: () => setOpen(false) }),
    [unread],
  );

  return (
    <NotificationCenterContext.Provider value={value}>
      {children}
      <NotificationPanel
        open={open}
        onClose={() => setOpen(false)}
        items={notifications}
        onItemRead={(id) => {
          notifications.find((n) => n.id === id)!.read = true; // demo; prod: optimistic (9.2)
        }}
      />
    </NotificationCenterContext.Provider>
  );
}

/** Trigger estándar: la campana con su badge. Reutilizable en header y hub. */
export function BellTrigger() {
  const { unread, openPanel } = useNotificationCenter();
  return <NotificationBell count={unread} onClick={openPanel} />;
}