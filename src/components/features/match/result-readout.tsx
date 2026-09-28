"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "torneos/lib/utils";
import { PlayerGrid } from "./player-grid";
import type { PlayerStatItem } from "./types";

export interface ResultReadoutSection {
  teamId: string;
  teamName: string;
  stats: PlayerStatItem[];
}

interface ResultReadoutProps {
  homeScore: number;
  awayScore: number;
  notes?: string | null;
  sections: ResultReadoutSection[];
  className?: string;
}

const COLS = [
  ["goals", "GO"], ["blueCards", "TA"], ["yellowCards", "AM"],
  ["redCards", "RO"], ["fouls", "FA"], ["ownGoals", "OG"],
] as const;

/** Resultado ya cargado: solo lectura. Grid por equipo + stats del jugador en
 *  ventana de fila completa (misma lógica que el detalle). Números tabulares. */
export function ResultReadout({ homeScore, awayScore, notes, sections, className }: ResultReadoutProps) {
  const [openTeamIds, setOpenTeamIds] = useState<Set<string>>(new Set());
  const [openPlayerId, setOpenPlayerId] = useState<string | null>(null);
  const toggleTeam = (teamId: string) => {
    setOpenTeamIds((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
  };

  return (
    <section className={cn("space-y-4 rounded-2xl bg-cypher-5-1 p-4", className)}>
      <p className="text-center font-mono text-3xl font-bold tabular-nums text-cypher-4">
        {homeScore} – {awayScore}
      </p>
      {notes && <p className="text-center text-xs text-cypher-4-2">{notes}</p>}

      {sections.map((section) => (
        <div key={section.teamId}>
          <button
            type="button"
            aria-expanded={openTeamIds.has(section.teamId)}
            onClick={() => toggleTeam(section.teamId)}
            className="mb-2 flex w-full items-center justify-between text-left"
          >
            <span className="text-[11px] font-semibold uppercase tracking-wider text-cypher-4-2-2">
              {section.teamName} · {section.stats.length}
            </span>
            {openTeamIds.has(section.teamId)
              ? <ChevronUp className="size-3.5 text-cypher-4-2" />
              : <ChevronDown className="size-3.5 text-cypher-4-2" />}
          </button>
          {openTeamIds.has(section.teamId) && (
            <PlayerGrid
              players={section.stats.map((s) => ({
                playerId: s.playerId,
                name: s.player.profile.displayName ?? "Jugador",
                image: s.player.profile.user.image,
              }))}
              openPlayerId={openPlayerId}
              onTogglePlayer={(playerId) =>
                setOpenPlayerId((prev) => (prev === playerId ? null : playerId))
              }
              renderPanel={(p) => {
                const stat = section.stats.find((s) => s.playerId === p.playerId);
                if (!stat) return null;
                return (
                  <div className="col-span-full rounded-xl border border-cypher-5-1-1 bg-cypher-5 p-3">
                    <p className="mb-2 text-sm font-semibold text-cypher-4">{p.name}</p>
                    <div className="grid grid-cols-6 gap-1.5">
                      {COLS.map(([field, label]) => (
                        <div key={field} className="rounded-lg bg-cypher-5-1-1 px-1 py-1.5 text-center">
                          <span className="block font-mono text-sm font-bold tabular-nums text-cypher-4">
                            {stat[field]}
                          </span>
                          <span className="block text-[9px] text-cypher-4-2-2">{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }}
            />
          )}
        </div>
      ))}
    </section>
  );
}