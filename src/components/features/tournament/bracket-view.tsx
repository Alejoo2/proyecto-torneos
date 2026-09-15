import { MatchRow, type MatchRowMatch } from "torneos/components/features/tournament/match-row";
import { cn } from "torneos/lib/utils";

type BracketMatch = MatchRowMatch & { phase: { id: string; name: string; order: number } };

interface BracketViewProps {
  matches: BracketMatch[];
  /** Base "/torneos/{tournamentId}/partidos" — si viene, cada fila enlaza al detalle (W4). */
  matchHrefBase?: string;
  className?: string;
}

function kickoffTime(m: BracketMatch): number {
  const t = m.scheduledAt ?? m.date;
  return t ? new Date(t).getTime() : Number.POSITIVE_INFINITY; // sin fecha → al final
}

export function BracketView({ matches, matchHrefBase, className }: BracketViewProps) {
  const phases = new Map<string, { id: string; name: string; order: number }>();
  for (const m of matches) phases.set(m.phase.id, m.phase);
  const ordered = [...phases.values()].sort((a, b) => a.order - b.order);

  return (
    <div className={cn("space-y-6", className)}>
      {ordered.map((phase) => {
        const phaseMatches = matches
          .filter((m) => m.phase.id === phase.id)
          .sort((a, b) => kickoffTime(a) - kickoffTime(b));
        return (
          <section key={phase.id}>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-cypher-4-2-2">
              {phase.name} · {phaseMatches.length}
            </h3>
            <div className="space-y-2">
              {phaseMatches.map((m) => (
                <MatchRow
                  key={m.id}
                  match={m}
                  href={
                    matchHrefBase && m.homeTeam && m.awayTeam
                      ? `${matchHrefBase}/${m.id}`
                      : undefined
                  }
                />
                ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}