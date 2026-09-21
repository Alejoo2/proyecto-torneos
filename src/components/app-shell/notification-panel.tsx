"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Inbox, X, CheckCheck, LogOut } from "lucide-react";
import {
  NotificationItem,
  type NotificationItemData,
} from "torneos/components/features/notifications/notification-item";
import { EmptyState } from "torneos/components/ui/empty-state";

interface NotificationPanelProps {
  open: boolean;
  onClose: () => void;
  items: NotificationItemData[];
  onItemRead?: (id: string) => void;
  onMarkAllRead?: () => void;
  isLoading?: boolean;
  /** N-2: presencia = footer de logout (salida universal de la app). */
  onLogout?: () => void;
}

/**
 * Bandeja desplegable (doc 3.4). Ocupa exactamente el área de contenido:
 * top = altura del header (h-14), bottom = nav + safe-area → borde inferior
 * SIEMPRE sobre la nav (2.4). Capa 45 (2.3). Cierre: tap fuera, X, Escape.
 */
const CONTENT_AREA =
  "absolute inset-x-0 top-14 bottom-[calc(4rem+env(safe-area-inset-bottom))]";

export function NotificationPanel({
  open,
  onClose,
  items,
  onItemRead,
  onMarkAllRead,
  isLoading,
  onLogout,
}: NotificationPanelProps) {
  const [logoutArmed, setLogoutArmed] = useState(false);
  const armTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Doble-toque auto-reset 3000ms (patrón W3). Se desarma al cerrar el panel.
  useEffect(() => {
    if (open) return;
    setLogoutArmed(false);
    if (armTimer.current !== null) window.clearTimeout(armTimer.current);
  }, [open]);
  useEffect(
    () => () => {
      if (armTimer.current !== null) window.clearTimeout(armTimer.current);
    },
    [],
  );

  const handleLogoutTap = () => {
    if (logoutArmed) {
      onLogout?.();
      return;
    }
    setLogoutArmed(true);
    armTimer.current = window.setTimeout(() => setLogoutArmed(false), 3000);
  };

  const hasUnread = items.some((item) => item.status === "UNREAD");

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Zona de tap-fuera: solo el área de contenido, la nav queda libre */}
          <motion.div
            className={`${CONTENT_AREA} z-notif-panel`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-label="Notificaciones"
            className={`${CONTENT_AREA} z-notif-panel flex flex-col border-b border-cypher-5-1-1 bg-cypher-5-1`}
            initial={{ y: "-100%" }}
            animate={{ y: 0 }}
            exit={{ y: "-100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
          >
            <div className="flex h-12 shrink-0 items-center justify-between border-b border-cypher-5-1-1 px-4">
              <h2 className="text-sm font-semibold text-cypher-4">Notificaciones</h2>
              <div className="flex items-center gap-2">
                {hasUnread && onMarkAllRead && (
                  <button
                    type="button"
                    onClick={onMarkAllRead}
                    aria-label="Marcar todas como leídas"
                    title="Marcar todas como leídas"
                    className="flex items-center gap-1 text-xs text-cypher-4-2 hover:text-cypher-4 transition-colors px-2 py-1 rounded"
                  >
                    <CheckCheck className="size-4" />
                    <span>Marcar leídas</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Cerrar"
                  className="flex size-8 items-center justify-center rounded-full text-cypher-4-2 transition-colors active:bg-cypher-5-1-1"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center p-8 text-xs text-cypher-4-2">
                  Cargando notificaciones...
                </div>
              ) : items.length === 0 ? (
                <EmptyState
                  icon={<Inbox className="size-8" />}
                  title="Sin notificaciones"
                  description="Cuando algo pase, aparecerá aquí."
                />
              ) : (
                items.map((n) => (
                  <NotificationItem key={n.id} notification={n} onRead={onItemRead} />
                ))
              )}
            </div>
            {onLogout && (
              <div className="shrink-0 border-t border-cypher-5-1-1 p-3">
                <button
                  type="button"
                  onClick={handleLogoutTap}
                  className={cnLogout(logoutArmed)}
                >
                  <LogOut className="size-4" />
                  <span>{logoutArmed ? "¿Confirmar salida?" : "Cerrar sesión"}</span>
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function cnLogout(armed: boolean) {
  return `flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold uppercase tracking-wide transition-colors active:scale-[0.98] ${
    armed
      ? "bg-red-500 text-white"
      : "border border-red-500/30 bg-red-500/10 text-red-400"
  }`;
}