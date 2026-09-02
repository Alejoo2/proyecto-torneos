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
        className="w-14 h-14 bg-gray-200 rounded-full flex items-center justify-center shrink-0 hover:scale-105 transition-transform overflow-hidden"
        aria-label={`Ver perfil de ${name}`}
      >
        {imageUrl ? (
          <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
        ) : (
          <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        )}
      </button>
      
      {/* Info Principal (Click para ver perfil) */}
      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onViewProfile(playerId)}>
        <h3 className="text-sm font-bold text-gray-900 truncate">{name}</h3>
        
        <div className="flex items-center gap-1.5 mt-1">
          <svg className="w-3 h-3 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-gray-500 truncate">{availabilitySummary}</p>
        </div>
        
        <div className="flex items-center gap-1.5 mt-0.5">
          <svg className="w-3 h-3 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <p className="text-xs text-gray-500">
            Equipos: {teamCount}/{maxTeams}
          </p>
        </div>
      </div>
      
      {/* Acciones */}
      <div className="flex gap-2 shrink-0">
        <Button
          onClick={() => onViewProfile(playerId)}
          variant="outline"
          className="text-xs min-h-40px px-4"
        >
          Ver
        </Button>
        
        {isInvited ? (
          <button 
            disabled 
            className="bg-gray-300 text-white px-4 py-2 rounded-xl text-xs font-medium cursor-not-allowed min-h-40px flex items-center"
            title="Invitación pendiente"
          >
            Invitado
          </button>
        ) : (
          <Button
            onClick={() => onInvite(playerId)}
            disabled={buttonDisabled}
            variant={buttonDisabled ? "primary" : "destructive"}
            className="text-xs min-h-40px px-4"
            title={isTeamFull ? "Tu equipo ya tiene 15 miembros" : isPlayerSaturated ? "El jugador está saturado" : "Enviar invitación"}
          >
            Invitar
          </Button>
        )}
      </div>
    </div>
  );
}