import { TeamChip } from "torneos/components/ui/team-chip";
import { cn } from "torneos/lib/utils";

export interface StandingRow {
  position: number;
  matchesPlayed: number;
  goalDifference: number;
  points: number;
  team: { id: string; name: string; abbreviation: string; primaryColor: string };
}

function dg(d: number): string {
  return d > 0 ? `+${d}` : `${d}`;
}

export function StandingsTable({ rows, className }: { rows: StandingRow[]; className?: string }) {
  return (
    <div className={cn("rounded-2xl bg-cypher-5-1 px-4 py-2", className)}>
      <div className="grid grid-cols-[1.75rem_1fr_2.25rem_2.5rem_2.5rem] items-center gap-1 border-b border-cypher-5-1-1 py-2 text-[10px] font-semibold uppercase tracking-wider text-cypher-4-2-2">
        <span>#</span>
        <span>Equipo</span>
        <span className="text-center">PJ</span>
        <span className="text-center">DG</span>
        <span className="text-center">PTS</span>
      </div>
      {rows.map((row) => (
        <div
          key={row.team.id}
          className="grid grid-cols-[1.75rem_1fr_2.25rem_2.5rem_2.5rem] items-center gap-1 border-b border-cypher-5-1-1/50 py-2.5 text-sm last:border-0"
        >
          <span className="tabular-nums text-cypher-4-2">{row.position}</span>
          <TeamChip team={row.team} className="min-w-0" />
          <span className="text-center tabular-nums text-cypher-4-2">{row.matchesPlayed}</span>
          <span className="text-center tabular-nums text-cypher-4-2">{dg(row.goalDifference)}</span>
          <span className="text-center font-bold tabular-nums text-cypher-4">{row.points}</span>
        </div>
      ))}
    </div>
  );
}