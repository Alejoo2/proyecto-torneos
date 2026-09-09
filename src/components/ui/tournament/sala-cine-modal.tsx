"use client";

import { Button } from "torneos/components/ui/button/button";

interface SalaCineModalProps {
  isOpen: boolean;
  secondsRemaining: number;
  teamName?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function SalaCineModal({ isOpen, secondsRemaining, teamName, onConfirm, onCancel }: SalaCineModalProps) {
  if (!isOpen) return null;

  const mins = Math.floor(secondsRemaining / 60);
  const secs = secondsRemaining % 60;
  const timeText = `${mins}:${secs.toString().padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 z-[80] bg-black/70 flex items-end justify-center">
      <div className="bg-white rounded-t-3xl p-6 w-full max-w-lg transform transition-transform duration-300">
        <div className="w-12 h-1.5 bg-zinc-200 rounded-full mx-auto mb-6"></div>
        
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-orange-50 rounded-2xl mb-3">
            <svg className="w-7 h-7 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-zinc-900 mb-1">Reserva tu cupo</h3>
          <p className="text-sm text-zinc-500">Tienes 5 minutos para confirmar la inscripción</p>
        </div>

        <div className="bg-orange-50 rounded-2xl p-4 mb-6 text-center border border-orange-100">
          <div className="text-xs text-orange-600 font-medium uppercase tracking-wide mb-1">Tiempo restante</div>
          <div className="text-4xl font-mono font-bold text-orange-500">{timeText}</div>
        </div>

        <div className="bg-zinc-50 rounded-2xl p-4 mb-6">
          <div className="text-sm text-zinc-700">
            Estás por inscribir a: <span className="font-bold">{teamName || "Tu equipo"}</span>
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1 min-h-[56px]" onClick={onCancel}>
            Cancelar
          </Button>
          <Button className="flex-1 min-h-[56px]" onClick={onConfirm}>
            Confirmar
          </Button>
        </div>
      </div>
    </div>
  );
}