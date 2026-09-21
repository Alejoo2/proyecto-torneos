import { Age } from "torneos/components/ui/age";
import { DAY_SHORT, slotToLabel } from "torneos/lib/hub";
import { cn } from "torneos/lib/utils";

/** Costura 7.3: shape probado por el scaffold + listPublic (vitrina). */
export interface TournamentListItem {
  id: string;
  name: string;
  court: { name: string };
  dayOfWeek: number;
  timeSlot: number;
  _count: { enrollments: number };
  maxTeams: number;
}

interface TournamentCardProps {
  tournament: TournamentListItem;
  /** Edad del dato de cupos (Patrón C). Opcional: fixtures de /design no la pasan. */
  dataUpdatedAt?: number;
  className?: string;
}

export function TournamentCard({ tournament, dataUpdatedAt, className }: TournamentCardProps) {
  return (
    <div className={cn("rounded-2xl border border-cypher-5-1-1 bg-cypher-5-1 p-4", className)}>
      <h3 className="truncate text-sm font-bold text-cypher-4">{tournament.name}</h3>
      <p className="mt-0.5 text-xs text-cypher-4-2-2">{tournament.court.name}</p>
      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="text-cypher-4-2">
          {DAY_SHORT[tournament.dayOfWeek] ?? ""} · {slotToLabel(tournament.timeSlot)}
        </span>
        <span className="flex items-center gap-1.5 font-medium text-cypher-4">
          {tournament._count.enrollments}/{tournament.maxTeams} equipos
          {dataUpdatedAt !== undefined && <Age dataUpdatedAt={dataUpdatedAt} />}
        </span>
      </div>
    </div>
  );
}