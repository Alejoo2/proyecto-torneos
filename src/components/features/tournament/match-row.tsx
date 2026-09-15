import Link from "next/link";
import { Badge } from "torneos/components/ui/badge";
import { TeamChip } from "torneos/components/ui/team-chip";
import { whenLabel } from "torneos/domain/match/format";
import { MATCH_STATUS } from "torneos/domain/status-labels";
import { cn } from "torneos/lib/utils";

export interface MatchRowTeam {
  id: string;
  name: string;
  abbreviation: string;
  primaryColor: string;
}

export interface MatchRowMatch {
  id: string;
  status: string; // MatchStatus
  scheduledAt?: Date | string | null;
  date?: Date | string | null;
  timeSlot?: number | null;
  homeTeam: MatchRowTeam | null; // null = TBD del bracket
  awayTeam: MatchRowTeam | null;
  result: { homeScore: number; awayScore: number } | null;
}

function Tbd({ className }: { className?: string }) {
  return <span className={cn("text-xs text-cypher-4-2-2", className)}>Por definir</span>;
}

export function MatchRow({
  match, href, className,
}: { match: MatchRowMatch; href?: string; className?: string }) {
  const statusMeta = MATCH_STATUS[match.status as keyof typeof MATCH_STATUS];
  const when = whenLabel(match);
  const score = match.result ? `${match.result.homeScore} – ${match.result.awayScore}` : null;

  const body = (
    <>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="text-[11px] text-cypher-4-2-2">{when ?? "Por agendar"}</span>
        <Badge variant={statusMeta?.variant ?? "neutral"} status={statusMeta?.label ?? match.status} />
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="flex min-w-0 items-center">
          {match.homeTeam ? <TeamChip team={match.homeTeam} className="min-w-0" /> : <Tbd />}
        </div>
        <span
          className={cn(
            "px-1 font-mono text-sm font-bold tabular-nums",
            score ? "text-cypher-4" : "text-cypher-4-2-2",
          )}
        >
          {score ?? "vs"}
        </span>
        <div className="flex min-w-0 flex-row-reverse items-center">
          {match.awayTeam ? <TeamChip team={match.awayTeam} className="min-w-0 flex-row-reverse" /> : <Tbd />}
        </div>
      </div>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cn("block rounded-2xl bg-cypher-5-1 p-3.5 transition-colors active:bg-cypher-5-1-1", className)}
      >
        {body}
      </Link>
    );
  }

  return <div className={cn("rounded-2xl bg-cypher-5-1 p-3.5", className)}>{body}</div>;
}