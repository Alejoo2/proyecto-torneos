import { cn } from "torneos/lib/utils";
import { PlayerRow } from "./player-row";
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

/** Resultado ya cargado: solo lectura. Números tabulares, sin acentos informativos. */
export function ResultReadout({ homeScore, awayScore, notes, sections, className }: ResultReadoutProps) {
  return (
    <section className={cn("space-y-5 rounded-2xl bg-cypher-5-1 p-4", className)}>
      <p className="text-center font-mono text-3xl font-bold tabular-nums text-cypher-4">
        {homeScore} – {awayScore}
      </p>
      {notes && <p className="text-center text-xs text-cypher-4-2">{notes}</p>}

      {sections.map((section) => (
        <div key={section.teamId}>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-cypher-4-2-2">
            {section.teamName}
          </h3>
          <div className="space-y-1.5">
            {section.stats.map((stat) => (
              <PlayerRow
                key={stat.playerId}
                player={stat.player}
                trailing={
                  <div className="flex shrink-0 items-center gap-1.5">
                    {COLS.map(([field, label]) => (
                      <span key={field} className="w-6 text-center">
                        <span className="block font-mono text-xs font-semibold tabular-nums text-cypher-4">
                          {stat[field]}
                        </span>
                        <span className="block text-[9px] text-cypher-4-2-2">{label}</span>
                      </span>
                    ))}
                  </div>
                }
              />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}