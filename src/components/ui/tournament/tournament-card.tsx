import { ChevronRight } from "lucide-react";
import { Age } from "torneos/components/ui/age";
import { Badge } from "torneos/components/ui/badge";
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
  /** Vitrina real (listPublic los trae); fixtures de /design pueden omitirlos → sin badges. */
  status?: string;
  enrollmentDeadline?: Date | string | null;
}

const WEEK_MS = 7 * 24 * 3600 * 1000;

/** Badges derivados en cliente, sin peticiones: estado + urgencia de cupo/cierre. */
function getBadges(t: TournamentListItem): string[] {
  const badges: string[] = [];
  if (t.status === "IN_PROGRESS") badges.push("En curso");
  const enrolled = t._count.enrollments;
  if (enrolled >= t.maxTeams) {
    badges.push("Lleno");
  } else if (t.maxTeams > 0 && enrolled / t.maxTeams >= 0.8) {
    badges.push("Últimos cupos");
  } else if (t.enrollmentDeadline) {
    const ms = new Date(t.enrollmentDeadline).getTime() - Date.now();
    if (ms > 0 && ms <= WEEK_MS) badges.push("Cierra pronto");
  }
  return badges.slice(0, 2);
}

interface TournamentCardProps {
  tournament: TournamentListItem;
  /** Edad del dato de cupos (Patrón C). Opcional: fixtures de /design no la pasan. */
  dataUpdatedAt?: number;
  className?: string;
}

export function TournamentCard({ tournament, dataUpdatedAt, className }: TournamentCardProps) {
  const badges = getBadges(tournament);
  return (
    <div className={cn("rounded-2xl border border-cypher-5-1-1 bg-cypher-5-1 p-4", className)}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="truncate text-sm font-bold text-cypher-4" title={tournament.name}>{tournament.name}</h3>
        {badges.length > 0 && (
          <span className="flex shrink-0 gap-1">
            {badges.map((b) => (
              <Badge key={b} variant="neutral" status={b} />
            ))}
          </span>
        )}
      </div>
      <p className="mt-0.5 truncate text-xs text-cypher-4-2-2" title={tournament.court.name}>{tournament.court.name}</p>
      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="text-cypher-4-2">
          {DAY_SHORT[tournament.dayOfWeek] ?? ""} · {slotToLabel(tournament.timeSlot)}
        </span>
        <span className="flex items-center gap-1.5 font-medium text-cypher-4">
          {tournament._count.enrollments}/{tournament.maxTeams} equipos
          {dataUpdatedAt !== undefined && <Age dataUpdatedAt={dataUpdatedAt} />}
        </span>
      </div>
      <span className="mt-3 flex items-center gap-1 text-xs font-semibold text-cypher-4-2">
        Ver torneo <ChevronRight className="size-3.5" />
      </span>
    </div>
  );
}