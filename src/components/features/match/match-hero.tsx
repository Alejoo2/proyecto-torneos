import { Badge } from "torneos/components/ui/badge";
import { TeamChip } from "torneos/components/ui/team-chip";
import { whenLabel } from "torneos/domain/match/format";
import { MATCH_STATUS, type MatchStatus } from "torneos/domain/status-labels";
import { cn } from "torneos/lib/utils";
import type { MatchWhen } from "torneos/domain/match/format";

export interface MatchHeroTeam {
  name: string;
  abbreviation: string;
  primaryColor: string;
}

interface MatchHeroProps extends MatchWhen {
  status: string;
  homeTeam: MatchHeroTeam | null;
  awayTeam: MatchHeroTeam | null;
  result?: { homeScore: number; awayScore: number } | null;
  phaseName?: string | null;
  courtName?: string | null;
  refereeName?: string | null;
  className?: string;
}

function Tbd() {
  return <span className="text-xs text-cypher-4-2-2">Por definir</span>;
}

export function MatchHero({
  status, homeTeam, awayTeam, result,
  scheduledAt, date, timeSlot,
  phaseName, courtName, refereeName, className,
}: MatchHeroProps) {
  const meta = MATCH_STATUS[status as MatchStatus];
  const when = whenLabel({ scheduledAt, date, timeSlot });
  const score = result ? `${result.homeScore} – ${result.awayScore}` : null;

  const metaParts = [phaseName, courtName, refereeName ? `Árbitro: ${refereeName}` : null].filter(Boolean);

  return (
    <section className={cn("rounded-2xl bg-cypher-5-1 p-4", className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-[11px] text-cypher-4-2-2">{when ?? "Por agendar"}</span>
        <Badge variant={meta?.variant ?? "neutral"} status={meta?.label ?? status} />
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="flex min-w-0 items-center">
          {homeTeam ? <TeamChip team={homeTeam} className="min-w-0" /> : <Tbd />}
        </div>
        <span
          className={cn(
            "px-1 font-mono text-lg font-bold tabular-nums",
            score ? "text-cypher-4" : "text-cypher-4-2-2",
          )}
        >
          {score ?? "vs"}
        </span>
        <div className="flex min-w-0 flex-row-reverse items-center">
          {awayTeam ? <TeamChip team={awayTeam} className="min-w-0 flex-row-reverse" /> : <Tbd />}
        </div>
      </div>
      {metaParts.length > 0 && (
        <p className="mt-3 text-center text-[11px] text-cypher-4-2-2">{metaParts.join(" · ")}</p>
      )}
    </section>
  );
}