"use client";

import { cloneElement, type ReactElement } from "react";
import { PlayerAvatar } from "torneos/components/ui/player-avatar";
import { cn } from "torneos/lib/utils";

export interface PlayerGridItem {
  playerId: string;
  name: string;
  image?: string | null;
  /** Marca visual persistente (bg cypher-3). La maneja el consumidor. */
  ready?: boolean;
}

interface PlayerGridProps {
  players: PlayerGridItem[];
  /** Un solo panel abierto en toda la pantalla. Clave de selección: playerId (única). */
  openPlayerId: string | null;
  onTogglePlayer: (playerId: string) => void;
  /** Panel acordeón; se inserta al final de la fila completa del jugador abierto. */
  renderPanel: (player: PlayerGridItem) => ReactElement | null;
  columns?: number;
  className?: string;
}

export function PlayerGrid({
  players, openPlayerId, onTogglePlayer, renderPanel, columns = 4, className,
}: PlayerGridProps) {
  const openIdx = players.findIndex((p) => p.playerId === openPlayerId);

  // ReactElement (no ReactNode): React 19 incluye Promise en ReactNode →
  // no-floating-promises falso positivo sobre el splice (lección W4).
  const cells: ReactElement[] = players.map((p) => {
    const open = p.playerId === openPlayerId;
    return (
      <button
        key={p.playerId}
        type="button"
        aria-expanded={open}
        onClick={() => onTogglePlayer(p.playerId)}
        className={cn(
          "flex flex-col items-center gap-1.5 rounded-xl border px-1 py-2 transition-colors",
          open ? "border-cypher-2" : "border-cypher-5-1-1",
          p.ready ? "bg-cypher-3" : "bg-cypher-5",
        )}
      >
        <PlayerAvatar profile={{ displayName: p.name, image: p.image }} size="sm" />
        <span className={cn("w-full truncate text-center text-[9px]", p.ready ? "text-cypher-5" : "text-cypher-4-2")}>
          {p.name}
        </span>
      </button>
    );
  });

  if (openIdx >= 0) {
    const lastOfRow = Math.min(
      (Math.floor(openIdx / columns) + 1) * columns - 1,
      players.length - 1,
    );
    const selected = players[openIdx];
    if (selected) {
      const panel = renderPanel(selected);
      if (panel) cells.splice(lastOfRow + 1, 0, cloneElement(panel, { key: "panel" }));
    }
  }

  return (
    <div
      className={cn("grid gap-2", className)}
      // columns dinámico: única excepción de estilo inline permitida (valor dinámico)
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {cells}
    </div>
  );
}