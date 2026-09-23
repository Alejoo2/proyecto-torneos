import { PlayerAvatar } from "torneos/components/ui/player-avatar";

export interface TacticalPlayer {
  playerId: string;
  displayName: string | null;
  image?: string | null;
}

interface TacticalViewProps {
  starters: TacticalPlayer[];
  className?: string;
}

/** W8.2 — Previsualización táctica: MITAD de cancha HORIZONTAL (4/3), fútbol 5.
 *  Los 5 slots son posiciones espaciales (coordenadas del wireframe), sin roles:
 *  no hay arquero ni delantero semántico. Líneas y anillo de avatar en turquesa
 *  (cypher-3): decoración no informativa (legal 4.2), idioma "titular" de W4/W8.
 *  Read-only: jamás emite eventos (N-3). */
const SLOTS = [
  { left: "8%", top: "45%" },  // portería (posición, no rol)
  { left: "22%", top: "25%" }, // defensa alta
  { left: "22%", top: "65%" }, // defensa baja
  { left: "38%", top: "45%" }, // medio
  { left: "55%", top: "45%" }, // adelante
] as const;

export function TacticalView({ starters, className }: TacticalViewProps) {
  return (
    <div className={`relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-cypher-5-1-1 bg-cypher-5 ${className ?? ""}`}>
      {/* Líneas de la cancha (SVG, coordenadas del wireframe) */}
      <svg
        className="absolute inset-0 size-full text-cypher-3"
        viewBox="0 0 400 300"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        {/* Borde exterior */}
        <rect x="10" y="10" width="380" height="280" rx="8" />
        {/* Línea media vertical */}
        <line x1="200" y1="10" x2="200" y2="290" />
        {/* Círculo central */}
        <circle cx="200" cy="150" r="40" />
        {/* Área */}
        <rect x="10" y="80" width="80" height="140" />
        {/* Portería */}
        <rect x="2" y="110" width="8" height="80" className="fill-cypher-5-1-1" stroke="none" />
      </svg>

      {/* Jugadores en cancha (posicionados por slot; los vacíos quedan punteados) */}
      {SLOTS.map((slot, i) => {
        const player = starters[i];
        return (
          <div
            key={player?.playerId ?? `slot-${i}`}
            className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
            style={{ left: slot.left, top: slot.top }}
          >
            {player ? (
              <div className="rounded-full border-2 border-cypher-3 bg-cypher-5 p-0.5 shadow-lg">
                <PlayerAvatar
                                    profile={{ displayName: player.displayName ?? "Jugador", image: player.image ?? null}}
                  size="sm"
                />
              </div>
            ) : (
              <div className="flex size-10 items-center justify-center rounded-full border-2 border-dashed border-cypher-5-1-1">
                <div className="size-4 rounded-full bg-cypher-5-1-1" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}