"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Inbox, X } from "lucide-react";
import {
  NotificationItem,
  type NotificationData,
} from "torneos/components/features/notifications/notification-item";
import { EmptyState } from "torneos/components/ui/empty-state";

interface NotificationPanelProps {
  open: boolean;
  onClose: () => void;
  items: NotificationData[];
  onItemRead?: (id: string) => void;
}

/**
 * Bandeja desplegable (doc 3.4). Ocupa exactamente el área de contenido:
 * top = altura del header (h-14), bottom = nav + safe-area → borde inferior
 * SIEMPRE sobre la nav (2.4). Capa 45 (2.3). Cierre: tap fuera, X, Escape.
 */
const CONTENT_AREA =
  "absolute inset-x-0 top-14 bottom-[calc(4rem+env(safe-area-inset-bottom))]";

export function NotificationPanel({ open, onClose, items, onItemRead }: NotificationPanelProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

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
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar"
                className="flex size-8 items-center justify-center rounded-full text-cypher-4-2 transition-colors active:bg-cypher-5-1-1"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {items.length === 0 ? (
                <EmptyState
                  icon={<Inbox className="size-8" />}
                  title="Sin notificaciones"
                  description="Cuando algo pase, aparece aquí."
                />
              ) : (
                items.map((n) => (
                  <NotificationItem key={n.id} notification={n} onRead={onItemRead} />
                ))
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}