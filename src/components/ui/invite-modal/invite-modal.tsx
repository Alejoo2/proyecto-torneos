import { TriangleAlert, User, Users } from "lucide-react";
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
    <div className="absolute inset-0 z-80 flex items-end justify-center bg-black/60">
      <div className="w-full rounded-t-3xl border border-cypher-5-1-1 bg-cypher-5-1 p-6 transition-transform duration-300">
        <div className="mx-auto mb-6 h-1 w-12 rounded-full bg-cypher-5-1-1" />
        
        {/* Avatar y nombre */}
        <div className="mb-4 flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-cypher-5-1-1">
            {playerAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={playerAvatar} alt={playerName ?? "Jugador"} className="h-full w-full object-cover" />
            ) : (
              <User className="size-8 text-cypher-4-2-2" />
            )}
          </div>
          <div>
            <h3 className="text-base font-bold text-cypher-4">{playerName}</h3>
            <p className="text-sm text-cypher-4-2-2">{availabilitySummary}</p>
          </div>
        </div>
        
        {/* Contador de equipos */}
        <div className="mb-3 flex items-center gap-2">
          <Users className="size-4 text-cypher-4-2-2" />
          <p className="text-sm font-medium text-cypher-4-2">Equipos: {teamCount}/15</p>
        </div>
        
        {/* Advertencia si tiene >= 12 equipos */}
        {showWarning && (
          <div className="mb-4 rounded-xl border border-amber-400/40 bg-amber-400/10 p-3">
            <div className="flex items-start gap-2">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-300" />
              <p className="text-xs font-medium text-amber-200">
                Este jugador está próximo a saturarse (12/15 equipos). Podría rechazar la invitación.
              </p>
            </div>
          </div>
        )}
        
        {/* Botones */}
        <div className="mt-4 flex gap-3">
          <Button 
            onClick={onClose} 
            variant="outline"
            className="flex-1 rounded-2xl text-base font-medium min-h-[56px]"
          >
            Cancelar
          </Button>
          <Button 
            onClick={onConfirm} 
            className="flex-1 rounded-2xl text-base font-medium min-h-[56px]"
          >
            Confirmar invitación
          </Button>
        </div>
      </div>
    </div>
  );
}