"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { CreateTeamForm } from "torneos/components/features/team/create-team-form";

interface CreateTeamSheetProps {
  open: boolean;
  onClose: () => void;
}

/** Bottom sheet (patrón W5: create-tournament-modal). Cierre: X, tap-fuera, Escape.
 *  La creación navega al detalle vía useCreateDraft.onSuccess → el sheet muere
 *  con la página (comportamiento existente del hook, contrato intacto). */
export function CreateTeamSheet({ open, onClose }: CreateTeamSheetProps) {
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
          <motion.div
            className="absolute inset-0 z-40 bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-label="Crear equipo"
            className="absolute inset-x-0 bottom-0 z-40 flex max-h-[85%] flex-col rounded-t-2xl border-t border-cypher-5-1-1 bg-cypher-5-1"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
          >
            <div className="flex h-12 shrink-0 items-center justify-between border-b border-cypher-5-1-1 px-4">
              <h2 className="text-sm font-semibold text-cypher-4">Crear equipo</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar"
                className="flex size-8 items-center justify-center rounded-full text-cypher-4-2 transition-colors active:bg-cypher-5-1-1"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="overflow-y-auto p-4 pb-6">
              <CreateTeamForm />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}