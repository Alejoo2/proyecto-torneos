"use client";

import { AnimatePresence, motion } from "motion/react";
import { Info } from "lucide-react";

interface ToastProps {
  toast: { title: string; subtitle?: string } | null;
}

/**
 * Toast del protocolo 4.4: una línea, anclado abajo sobre la nav (enmienda
 * al "arriba" de 2.3: en el hub la parte superior pertenece a search+filtros).
 * z-toast (70): siempre visible, incluso sobre la burbuja. Entrada/salida = Motion.
 */
export function Toast({ toast }: ToastProps) {
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
        className="absolute inset-x-6 bottom-6 z-toast flex justify-center"
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        >
          <div className="flex max-w-full items-center gap-2.5 rounded-full border border-cypher-5-1-1 bg-cypher-5-1 px-4 py-2.5 shadow-[0_6px_20px_rgba(0,0,0,0.5)]">
            <Info className="h-4 w-4 shrink-0 text-cypher-3" />
            <p className="truncate text-xs font-medium text-cypher-4">
              {toast.title}
              {toast.subtitle && <span className="text-cypher-4-2"> · {toast.subtitle}</span>}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}