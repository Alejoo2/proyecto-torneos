import { Button } from "torneos/components/ui/button/button";

interface InviteModalProps {
  isOpen: boolean;
  playerName: string | null;
  playerAvatar: string | null;
  availabilitySummary: string | null;
  teamCount: number | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function InviteModal({
  isOpen,
  playerName,
  playerAvatar,
  availabilitySummary,
  teamCount,
  onClose,
  onConfirm,
}: InviteModalProps) {
  if (!isOpen) return null;

  const showWarning = (teamCount ?? 0) >= 12;

  return (
    <div className="absolute inset-0 z-80 bg-gray-950/60 flex items-end justify-center">
      <div className="bg-white rounded-t-3xl p-6 w-full transform translate-y-0 transition-transform duration-300">
        <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-6" />
        
        {/* Avatar y nombre */}
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center shrink-0 overflow-hidden">
            {playerAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={playerAvatar} alt={playerName ?? "Jugador"} className="w-full h-full object-cover" />
            ) : (
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            )}
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">{playerName}</h3>
            <p className="text-sm text-gray-500">{availabilitySummary}</p>
          </div>
        </div>
        
        {/* Contador de equipos */}
        <div className="flex items-center gap-2 mb-3">
          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <p className="text-sm text-gray-600 font-medium">Equipos: {teamCount}/15</p>
        </div>
        
        {/* Advertencia si tiene >= 12 equipos */}
        {showWarning && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-xs text-amber-700 font-medium">
                Este jugador está próximo a saturarse (12/15 equipos). Podría rechazar la invitación.
              </p>
            </div>
          </div>
        )}
        
        {/* Botones */}
        <div className="flex gap-3 mt-4">
          <Button 
            onClick={onClose} 
            variant="outline"
            className="flex-1 min-h-56px rounded-2xl text-base font-medium"
          >
            Cancelar
          </Button>
          <Button 
            onClick={onConfirm} 
            className="flex-1 min-h-56px rounded-2xl text-base font-medium"
          >
            Confirmar invitación
          </Button>
        </div>
      </div>
    </div>
  );
}