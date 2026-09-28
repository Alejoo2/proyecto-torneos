"use client";

import { User, X } from "lucide-react";
import { AvailabilityMatrix } from "torneos/components/ui/availability-matrix/availability-matrix";

interface PlayerProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerName: string | null;
  playerAvatar: string | null;
  playerBio: string | null;
  slots: {
    dayOfWeek: number;
    timeSlot: number;
    status: "AVAILABLE" | "UNAVAILABLE" | "CONFLICT";
  }[];
}

export function PlayerProfileModal({
  isOpen,
  onClose,
  playerName,
  playerAvatar,
  playerBio,
  slots,
}: PlayerProfileModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="flex max-h-[90dvh] w-full max-w-md flex-col overflow-y-auto rounded-t-3xl bg-cypher-5-1 shadow-xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-3xl border-b border-cypher-5-1-1 bg-cypher-5-1 px-6 py-4">
          <h2 className="text-lg font-bold text-cypher-4">Perfil del Jugador</h2>
          <button 
            onClick={onClose} 
            className="flex h-10 w-10 items-center justify-center rounded-full text-cypher-4-2 transition-colors hover:bg-cypher-4/10 hover:text-cypher-4 active:bg-cypher-4/15"
            aria-label="Cerrar modal"
          >
            <X className="size-6" />
          </button>
        </div>

        {/* Contenido */}
        <div className="flex flex-col gap-6 px-6 py-6">
          {/* Datos Principales */}
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-cypher-4-2-2/40 bg-cypher-5-1-1">
              {playerAvatar ? (
                <img src={playerAvatar} alt={playerName ?? "Avatar"} className="h-full w-full object-cover" />
              ) : (
                <User className="size-10 text-cypher-4-2-2" />
              )}
            </div>
            <div>
              <h3 className="text-xl font-extrabold text-cypher-4">{playerName ?? "Jugador Anónimo"}</h3>
              {playerBio && <p className="mt-1 text-sm text-cypher-4-2-2 line-clamp-2">{playerBio}</p>}
            </div>
          </div>

          {/* Matriz de Disponibilidad */}
          <div className="flex flex-col gap-3">
            <h4 className="text-sm font-bold uppercase tracking-wide text-cypher-4-2">Disponibilidad Horaria</h4>
            <div className="rounded-2xl border border-cypher-5-1-1 bg-cypher-5 p-4">
              <AvailabilityMatrix slots={slots} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}