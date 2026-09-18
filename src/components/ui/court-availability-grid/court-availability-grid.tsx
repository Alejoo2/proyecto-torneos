import { courtAvailabilityCellVariants } from "./court-availability-grid.variants";
import { dayLabel } from "torneos/domain/schedule/labels";

// W5 — Matriz pública de disponibilidad (7 días × 12 franjas de 2h).
// Lenguaje visual del hub W1: días = filas, libre = verde semántico, leyenda.
// Es la matriz que se quitó del bubble en W1 y aterriza aquí (solo lectura):
// consume el read-model de court.getBubble (days[].slots[].isFree) — sin estado,
// sin toggles. La edición admin vive en court-availability-matrix (contrato intacto).
// getBubble SOLO devuelve canchas ENABLED (DISABLED → 404 en la page): la matriz
// pública no conoce el estado apagado — no hay prop de corte.

export interface CourtAvailabilityDay {
  /** ISO UTC medianoche (columna @db.Date) — se lee con getters UTC para no correr el día. */
  date: string;
  /** 0..6 (0 = Domingo), derivado por el backend. */
  dayOfWeek: number;
  slots: { timeSlot: number; isFree: boolean }[];
}

interface CourtAvailabilityGridProps {
  days: CourtAvailabilityDay[];
}

const SLOT_COUNT = 12;

export function CourtAvailabilityGrid({ days }: CourtAvailabilityGridProps) {
  return (
    <div>
      <div
        role="img"
        aria-label="Matriz de disponibilidad de los próximos 7 días. Verde: libre. Gris: ocupada o cerrada."
        className="grid grid-cols-[52px_repeat(12,1fr)] gap-1"
      >
        <div />
        {Array.from({ length: SLOT_COUNT }, (_, slot) => (
          <div key={slot} className="pb-1 text-center text-[9px] tabular-nums text-cypher-4-2-2">
            {slot * 2}h
          </div>
        ))}

        {days.map((day) => {
          const dateUtc = new Date(day.date);
          return (
            <div key={day.date} className="col-span-full grid grid-cols-[52px_repeat(12,1fr)] gap-1">
              <div className="pr-1 text-right leading-tight">
                <p className="text-[10px] font-semibold text-cypher-4-2">{dayLabel(day.dayOfWeek).slice(0, 3)}</p>
                <p className="text-[9px] tabular-nums text-cypher-4-2-2">
                  {dateUtc.getUTCDate()}/{dateUtc.getUTCMonth() + 1}
                </p>
              </div>
              {Array.from({ length: SLOT_COUNT }, (_, slot) => {
                const isFree = day.slots.some((s) => s.timeSlot === slot && s.isFree);
                return <div key={slot} className={courtAvailabilityCellVariants({ state: isFree ? "free" : "busy" })} />;
              })}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-4 text-[11px] text-cypher-4-2">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-[3px] bg-green-500" />
          Libre
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-[3px] border border-cypher-4-2-2/30 bg-cypher-5-1-1" />
          Ocupada / cerrada
        </span>
      </div>
    </div>
  );
}