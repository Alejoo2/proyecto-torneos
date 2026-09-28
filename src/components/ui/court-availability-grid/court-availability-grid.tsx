import { courtAvailabilityCellVariants } from "./court-availability-grid.variants";
import { dayLabel } from "torneos/domain/schedule/labels";
import { SLOT_GRID_HEADERS } from "torneos/domain/schedule/labels";
import { SlotGrid } from "torneos/components/ui/availability-matrix/slot-grid";

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
  slots: { timeSlot: number; isFree: boolean; state?: "reserved" | "confirmed" | null }[];
}

interface CourtAvailabilityGridProps {
  days: CourtAvailabilityDay[];
  /** Selección de franja (reprogramar): solo celdas libres emiten. */
  selected?: { date: string; timeSlot: number } | null;
  onSelectSlot?: (date: string, timeSlot: number) => void;
}

const SLOT_COUNT = 12;

export function CourtAvailabilityGrid({ days, selected, onSelectSlot }: CourtAvailabilityGridProps) {
  return (
    <div>
      <SlotGrid
        columns={[...SLOT_GRID_HEADERS]}
        label="Matriz de disponibilidad de los próximos 7 días. Verde: libre. Gris: ocupada o cerrada."
        rows={days.map((day) => {
          const dateUtc = new Date(day.date);
          return {
            key: day.date,
            label: dayLabel(day.dayOfWeek).slice(0, 3),
            sub: `${dateUtc.getUTCDate()}/${dateUtc.getUTCMonth() + 1}`,
            cells: Array.from({ length: SLOT_COUNT }, (_, slot) => {
              const cell = day.slots.find((s) => s.timeSlot === slot);
              const state = cell?.state === "confirmed"
                ? ("confirmed" as const)
                : cell?.state === "reserved"
                  ? ("reserved" as const)
                  : cell?.isFree
                    ? ("free" as const)
                    : ("busy" as const);
              const isSelected = selected?.date === day.date && selected?.timeSlot === slot;
              const cellClass = courtAvailabilityCellVariants({ state }) +
                (isSelected ? " ring-2 ring-cypher-2 ring-offset-1 ring-offset-cypher-5" : "");
              if (onSelectSlot && state === "free") {
                return (
                  <button
                    key={slot}
                    type="button"
                    aria-pressed={isSelected}
                    aria-label={`Elegir franja ${day.date} ${slot}`}
                    onClick={() => onSelectSlot(day.date, slot)}
                    className={cellClass}
                  />
                );
              }
              return <div key={slot} className={cellClass} aria-hidden={onSelectSlot ? true : undefined} />;
            }),
          };
        })}
      />

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-cypher-4-2">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-[3px] bg-green-500" />
          Libre
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-[3px] border border-cypher-4-2-2/30 bg-cypher-5-1-1" />
          Ocupada / cerrada
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-[3px] bg-cypher-3" />
          Apartada
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-[3px] bg-cypher-1" />
          Confirmada
        </span>
      </div>
    </div>
  );
}