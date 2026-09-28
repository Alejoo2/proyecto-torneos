import { Clock, User, Users } from "lucide-react";
import { Button } from "torneos/components/ui/button/button";
import { playerCardVariants } from "torneos/components/ui/player-card/player-card.variants";

interface PlayerCardProps {
  playerId: string;
  name: string;
  imageUrl: string | null;
  availabilitySummary: string;
  teamCount: number;
  maxTeams: number;
  isInvited: boolean;
  isTeamFull: boolean;
  onInvite: (playerId: string) => void;
  onViewProfile: (playerId: string) => void; // NUEVO
}

export function PlayerCard({
  playerId,
  name,
  imageUrl,
  availabilitySummary,
  teamCount,
  maxTeams,
  isInvited,
  isTeamFull,
  onInvite,
  onViewProfile,
}: PlayerCardProps) {
  const isPlayerSaturated = teamCount >= maxTeams;
  const buttonDisabled = isTeamFull || isInvited || isPlayerSaturated;

  return (
    <div className={playerCardVariants({ status: isPlayerSaturated ? "saturated" : "default" })}>
      {/* Avatar (Click para ver perfil) */}
      <button 
        onClick={() => onViewProfile(playerId)}
        className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-cypher-5-1-1 transition-transform hover:scale-105"
        aria-label={`Ver perfil de ${name}`}
      >
        {imageUrl ? (
          <img src={imageUrl} alt={name} className="h-full w-full object-cover" />
        ) : (
          <User className="size-7 text-cypher-4-2-2" />
        )}
      </button>
      
      {/* Info Principal (Click para ver perfil) */}
      <div className="min-w-0 flex-1 cursor-pointer" onClick={() => onViewProfile(playerId)}>
        <h3 className="truncate text-sm font-bold text-cypher-4">{name}</h3>
        
        <div className="mt-1 flex items-center gap-1.5">
          <Clock className="size-3 shrink-0 text-cypher-4-2-2" />
          <p className="truncate text-xs text-cypher-4-2-2">{availabilitySummary}</p>
        </div>
        
        <div className="mt-0.5 flex items-center gap-1.5">
          <Users className="size-3 shrink-0 text-cypher-4-2-2" />
          <p className="text-xs text-cypher-4-2-2">
            Equipos: {teamCount}/{maxTeams}
          </p>
        </div>
      </div>
      
      {/* Acciones */}
      <div className="flex shrink-0 gap-2">
        <Button
          onClick={() => onViewProfile(playerId)}
          variant="outline"
          className="px-4 text-xs min-h-[44px]"
        >
          Ver
        </Button>
        
        {isInvited ? (
          <button 
            disabled 
            className="flex min-h-[44px] cursor-not-allowed items-center rounded-xl bg-cypher-5-1-1 px-4 py-2 text-xs font-medium text-cypher-4-2-2"
            title="Invitación pendiente"
          >
            Invitado
          </button>
        ) : (
          <Button
            onClick={() => onInvite(playerId)}
            disabled={buttonDisabled}
            variant={buttonDisabled ? "primary" : "destructive"}
            className="px-4 text-xs min-h-[44px]"
            title={isTeamFull ? "Tu equipo ya tiene 15 miembros" : isPlayerSaturated ? "El jugador está saturado" : "Enviar invitación"}
          >
            Invitar
          </Button>
        )}
      </div>
    </div>
  );
}