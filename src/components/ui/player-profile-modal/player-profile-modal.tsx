"use client";

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
      <div className="w-full max-w-md bg-white rounded-t-3xl shadow-xl max-h-[90dvh] overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-100 flex justify-between items-center rounded-t-3xl z-10">
          <h2 className="text-lg font-bold text-gray-900">Perfil del Jugador</h2>
          <button 
            onClick={onClose} 
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors text-gray-500"
            aria-label="Cerrar modal"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Contenido */}
        <div className="px-6 py-6 flex flex-col gap-6">
          {/* Datos Principales */}
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center shrink-0 overflow-hidden border-2 border-gray-800">
              {playerAvatar ? (
                <img src={playerAvatar} alt={playerName ?? "Avatar"} className="w-full h-full object-cover" />
              ) : (
                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              )}
            </div>
            <div>
              <h3 className="text-xl font-extrabold text-gray-900">{playerName ?? "Jugador Anónimo"}</h3>
              {playerBio && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{playerBio}</p>}
            </div>
          </div>

          {/* Matriz de Disponibilidad */}
          <div className="flex flex-col gap-3">
            <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Disponibilidad Horaria</h4>
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
              <AvailabilityMatrix slots={slots} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}