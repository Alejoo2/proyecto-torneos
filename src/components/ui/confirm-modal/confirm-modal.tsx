"use client";

import { cn } from "torneos/lib/utils";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
}

/** Modal de revisión para acciones de alta consecuencia (enmienda de convención W4):
 *  irreversible + mucho contexto que revisar → modal con resumen; el doble-toque
 *  queda para acciones de fila. Los \n del message se respetan (pre-line). */
export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  variant = "primary",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-5">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-md rounded-2xl border border-cypher-5-1-1 bg-cypher-5-1 p-5"
      >
        <h2 className="text-lg font-bold text-cypher-4">{title}</h2>
        <p className="mt-2 whitespace-pre-line text-sm text-cypher-4-2">{message}</p>

        <div className="mt-5 flex flex-col gap-2">
          <button
            onClick={onConfirm}
            className={cn(
              "w-full rounded-xl py-3 text-sm font-bold uppercase tracking-wide transition-colors active:scale-[0.98]",
              variant === "danger"
                ? "bg-red-500 text-white hover:bg-red-600"
                : "bg-cypher-2 text-cypher-5 hover:bg-cypher-2-1",
            )}
          >
            {confirmText}
          </button>
          <button
            onClick={onCancel}
            className="w-full rounded-xl border border-cypher-5-1-1 py-3 text-sm font-bold uppercase tracking-wide text-cypher-4-2 transition-colors active:scale-[0.98] active:bg-cypher-5-1-1"
          >
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
}