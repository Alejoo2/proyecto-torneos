import { CalendarClock, CalendarDays, MapPin, Users } from "lucide-react";
import { Badge } from "torneos/components/ui/badge";
import { Age } from "torneos/components/ui/age";
import { dayLabel, slotLabel } from "torneos/domain/schedule/labels";
import { TOURNAMENT_STATUS } from "torneos/domain/status-labels";
import { cn } from "torneos/lib/utils";

interface TournamentHeroProps {
  name: string;
  status: string; // TournamentStatus
  format: string; // TournamentFormat
  courtName: string;
  dayOfWeek?: number;
  timeSlot?: number;
  enrollmentDeadline?: Date | string | null;
  startDate?: Date | string | null;
  enrolledCount: number;
  maxTeams: number;
  activeHolds: number;
  dataUpdatedAt: number;
  className?: string;
}

function formatLabel(format: string): string {
  if (format === "SINGLE_ELIMINATION") return "Eliminación directa";
  if (format === "LEAGUE_PLUS_ELIMINATION") return "Liga + Eliminación";
  if (format === "LEAGUE") return "Liga";
  return format;
}

function fmtDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("es-CO", { day: "numeric", month: "short", timeZone: "America/Bogota" });
}

export function TournamentHero({
  name, status, format, courtName, dayOfWeek, timeSlot,
  enrollmentDeadline, startDate, enrolledCount, maxTeams,
  activeHolds, dataUpdatedAt, className,
}: TournamentHeroProps) {
  // D3: libres = cupos − inscripciones activas − holds vigentes
  const free = Math.max(0, maxTeams - enrolledCount - activeHolds);
  const pct = maxTeams > 0 ? Math.min(100, Math.round((enrolledCount / maxTeams) * 100)) : 0;
  const day = typeof dayOfWeek === "number" ? dayLabel(dayOfWeek) : "";
  const slot = typeof timeSlot === "number" ? slotLabel(timeSlot) : "";
  const statusMeta = TOURNAMENT_STATUS[status as keyof typeof TOURNAMENT_STATUS];

  return (
    <header className={cn("px-5 pt-4", className)}>
      <Badge variant={statusMeta?.variant ?? "neutral"} status={statusMeta?.label ?? status} />
      <h1 className="glow-lime mt-2 text-2xl font-bold leading-tight text-cypher-4">{name}</h1>
      <p className="mt-1.5 flex items-center gap-1.5 text-sm text-cypher-4-2">
        <MapPin className="size-4 shrink-0" aria-hidden />
        <span className="truncate">{courtName}</span>
        <span className="shrink-0 text-cypher-4-2-2">· {formatLabel(format)}</span>
      </p>

      {/* Patrón C: el número informa, <Age/> declara su edad. La barra es detalle
          gráfico (acento permitido, 4.2 regla 2) — jamás portadora del dato.
          width inline = dato dinámico, excepción 3.2 documentada. */}
      <div className="mt-4 rounded-2xl bg-cypher-5-1 p-4">
        <div className="flex items-baseline justify-between">
          <p className="flex items-baseline gap-1">
            <span className="text-2xl font-bold tabular-nums text-cypher-4">{enrolledCount}</span>
            <span className="text-sm text-cypher-4-2-2">/{maxTeams} equipos</span>
          </p>
          <Age dataUpdatedAt={dataUpdatedAt} className="text-[11px] text-cypher-4-2-2" />
        </div>
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-cypher-5-1-1">
          <div className="h-full rounded-full bg-cypher-2" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2.5 flex items-center gap-1.5 text-xs text-cypher-4-2">
          <Users className="size-3.5" aria-hidden />
          {free > 0 ? `${free} ${free === 1 ? "cupo libre" : "cupos libres"}` : "Cupos agotados"}
          {activeHolds > 0 && (
            <span className="text-cypher-4-2-2">· {activeHolds} reservando ahora</span>
          )}
        </p>
      </div>

      {(Boolean(day) || Boolean(slot) || Boolean(enrollmentDeadline) || Boolean(startDate)) && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-cypher-4-2">
          {day && (
            <span className="flex items-center gap-1">
              <CalendarDays className="size-3.5" aria-hidden />
              {day}
              {slot && ` · ${slot}`}
            </span>
          )}
          {startDate && (
            <span className="flex items-center gap-1">
              <CalendarDays className="size-3.5" aria-hidden />
              Inicia {fmtDate(startDate)}
            </span>
          )}
          {enrollmentDeadline && (
            <span className="flex items-center gap-1">
              <CalendarClock className="size-3.5" aria-hidden />
              Cierra inscripción: {fmtDate(enrollmentDeadline)}
            </span>
          )}
        </div>
      )}
    </header>
  );
}