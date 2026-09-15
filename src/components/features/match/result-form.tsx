"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "torneos/components/ui/button/button";
import { TeamChip } from "torneos/components/ui/team-chip";
import { cn } from "torneos/lib/utils";
import { PlayerRow } from "./player-row";
import type { CallUpItem } from "./types";

// Espejo del zod de result.load: todos los contadores son enteros ≥ 0.
// `notes` requiere la enmienda aditiva a result.ts (ver pendientes) — z.max(500).
const MAX_NOTES = 500;

const STAT_FIELDS = [
  ["goals", "GO"], ["blueCards", "TA"], ["yellowCards", "AM"],
  ["redCards", "RO"], ["fouls", "FA"], ["ownGoals", "OG"],
] as const;

type StatField = (typeof STAT_FIELDS)[number][0];

type StatStrings = Record<StatField, string>;

export interface ResultPayload {
  homeScore: number;
  awayScore: number;
  notes?: string;
  playerStats: {
    playerId: string; teamId: string;
    goals: number; blueCards: number; yellowCards: number;
    redCards: number; fouls: number; ownGoals: number;
  }[];
}

interface ResultFormProps {
  homeTeam: { id: string; name: string; abbreviation: string; primaryColor: string };
  awayTeam: { id: string; name: string; abbreviation: string; primaryColor: string };
  callUps: CallUpItem[];
  isPending?: boolean;
  onSubmit: (payload: ResultPayload) => void;
  className?: string;
}

const zeroStats = (): StatStrings => ({ goals: "0", blueCards: "0", yellowCards: "0", redCards: "0", fouls: "0", ownGoals: "0" });

function toNonNegativeInt(v: string): number | null {
  return /^\d+$/.test(v) ? Number(v) : null;
}

function StatInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <span className="w-9 text-center">
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, "").slice(0, 2))}
        className="w-9 rounded-md border border-cypher-5-1-1 bg-cypher-5 px-1 py-1 text-center font-mono text-xs tabular-nums text-cypher-4 outline-none focus:border-cypher-2"
        aria-label={label}
      />
      <span className="mt-0.5 block text-[9px] text-cypher-4-2-2">{label}</span>
    </span>
  );
}

/** Form de carga de resultado (solo gestor). Marcador + stats inline por convocado
 *  + observaciones. Doble toque con auto-reset (patrón W3, jamás confirm()). */
export function ResultForm({
  homeTeam, awayTeam, callUps, isPending, onSubmit, className,
}: ResultFormProps) {
  const [homeScore, setHomeScore] = useState("0");
  const [awayScore, setAwayScore] = useState("0");
  const [notes, setNotes] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [stats, setStats] = useState<Record<string, StatStrings>>(() =>
    Object.fromEntries(callUps.map((c) => [c.playerId, zeroStats()])),
  );

  // Auto-reset de la doble confirmación (protocolo W3)
  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), 4000);
    return () => clearTimeout(t);
  }, [confirming]);

  const home = toNonNegativeInt(homeScore);
  const away = toNonNegativeInt(awayScore);
  const scoresValid = home !== null && away !== null;

  const sections = useMemo(
    () => [
      { team: homeTeam, players: callUps.filter((c) => c.teamId === homeTeam.id) },
      { team: awayTeam, players: callUps.filter((c) => c.teamId === awayTeam.id) },
    ],
    [callUps, homeTeam, awayTeam],
  );

  const setStat = (playerId: string, field: StatField, value: string) => {
    setStats((prev) => ({ ...prev, [playerId]: { ...prev[playerId], [field]: value } }));
  };

  const handleClick = () => {
    if (isPending) return;
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    if (home === null || away === null) return;
    onSubmit({
      homeScore: home,
      awayScore: away,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      playerStats: callUps.map((c) => {
        const s = stats[c.playerId] ?? zeroStats();
        return {
          playerId: c.playerId, teamId: c.teamId,
          goals: Number(s.goals), blueCards: Number(s.blueCards), yellowCards: Number(s.yellowCards),
          redCards: Number(s.redCards), fouls: Number(s.fouls), ownGoals: Number(s.ownGoals),
        };
      }),
    });
  };

  return (
    <section className={cn("rounded-2xl bg-cypher-5-1 p-4", className)}>
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-cypher-4-2-2">
        Cargar resultado
      </h3>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <TeamChip team={homeTeam} className="min-w-0" />
        <div className="flex items-center gap-1.5">
          <input
            type="text" inputMode="numeric" value={homeScore} aria-label="Goles local"
            onChange={(e) => setHomeScore(e.target.value.replace(/[^\d]/g, "").slice(0, 2))}
            className="w-12 rounded-lg border border-cypher-5-1-1 bg-cypher-5 py-1.5 text-center font-mono text-lg font-bold tabular-nums text-cypher-4 outline-none focus:border-cypher-2"
          />
          <span className="font-mono text-sm text-cypher-4-2-2">–</span>
          <input
            type="text" inputMode="numeric" value={awayScore} aria-label="Goles visitante"
            onChange={(e) => setAwayScore(e.target.value.replace(/[^\d]/g, "").slice(0, 2))}
            className="w-12 rounded-lg border border-cypher-5-1-1 bg-cypher-5 py-1.5 text-center font-mono text-lg font-bold tabular-nums text-cypher-4 outline-none focus:border-cypher-2"
          />
        </div>
        <TeamChip team={awayTeam} className="min-w-0 flex-row-reverse" />
      </div>

      {callUps.length === 0 ? (
        <p className="mt-4 text-center text-xs text-cypher-4-2-2">
          Sin convocatoria: se guardará solo el marcador.
        </p>
      ) : (
        <div className="mt-5 space-y-5">
          {sections.map(({ team, players }) => (
            <div key={team.id}>
              <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-cypher-4-2-2">
                {team.name}
              </h4>
              <div className="space-y-2">
                {players.map((c) => (
                  <PlayerRow
                    key={c.id}
                    player={c.player}
                    trailing={
                      <div className="flex shrink-0">
                        {STAT_FIELDS.map(([field, label]) => (
                          <StatInput
                            key={field}
                            label={label}
                            value={stats[c.playerId]?.[field] ?? "0"}
                            onChange={(v) => setStat(c.playerId, field, v)}
                          />
                        ))}
                      </div>
                    }
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <textarea
        value={notes}
        maxLength={MAX_NOTES}
        rows={2}
        placeholder="Observaciones (opcional)"
        onChange={(e) => setNotes(e.target.value)}
        className="mt-4 w-full resize-none rounded-xl border border-cypher-5-1-1 bg-cypher-5 px-3 py-2 text-xs text-cypher-4 outline-none placeholder:text-cypher-4-2-2 focus:border-cypher-2"
      />

      <Button
        className="mt-4 w-full"
        size="lg"
        disabled={!scoresValid || isPending}
        onClick={handleClick}
      >
        {isPending
          ? "Guardando…"
          : confirming
            ? "¿Confirmar carga del resultado?"
            : "Guardar Resultado"}
      </Button>
    </section>
  );
}