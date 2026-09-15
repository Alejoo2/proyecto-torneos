import { PlayerAvatar } from "torneos/components/ui/player-avatar";
import { cn } from "torneos/lib/utils";
import type { PlayerRef } from "./types";

interface PlayerRowProps {
  player: PlayerRef;
  trailing?: React.ReactNode;
  className?: string;
}

/** Fila delgada de convocatoria (avatar + nombre). NO es player-card: la card
 *  completa tiene demasiado padding para listas inline (decisión del informe). */
export function PlayerRow({ player, trailing, className }: PlayerRowProps) {
  return (
    <div className={cn("flex items-center gap-2.5 rounded-xl border border-cypher-5-1-1 bg-cypher-5 px-3 py-2", className)}>      <PlayerAvatar
        profile={{ displayName: player.profile.displayName ?? "Jugador", image: player.profile.user.image }}        size="sm"
        className="shrink-0"
      />
      <span className="min-w-0 flex-1 truncate text-sm text-cypher-4">
        {player.profile.displayName ?? "Jugador"}
      </span>
      {trailing}
    </div>
  );
}