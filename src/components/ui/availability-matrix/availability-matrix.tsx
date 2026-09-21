import { DAY_LABELS, SLOT_LABELS } from "torneos/domain/schedule/labels";
import { cellVariants } from "./availability-matrix.variants";

interface AvailabilityMatrixProps {
  slots: {
    dayOfWeek: number;
    timeSlot: number;
    status: "AVAILABLE" | "UNAVAILABLE" | "CONFLICT";
  }[];
  onToggleSlot?: (dayOfWeek: number, timeSlot: number) => void;
}

// Orden de visualización lunes→domingo. Modelo: dayOfWeek 0 = domingo.
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

export function AvailabilityMatrix({ slots, onToggleSlot }: AvailabilityMatrixProps) {
  const getSlotStatus = (day: number, slot: number) => {
    const found = slots.find((s) => s.dayOfWeek === day && s.timeSlot === slot);
    return found?.status ?? "UNAVAILABLE";
  };

  return (
    <div className="w-full overflow-x-auto pb-4">
      <div className="min-w-[600px]">
        <div className="grid grid-cols-[60px_repeat(7,1fr)] gap-1 mb-2">
          <div />
          {DISPLAY_ORDER.map((dayIndex) => (
            <div key={dayIndex} className="text-center text-xs font-bold uppercase text-cypher-4-2-2">
              {DAY_LABELS[dayIndex].slice(0, 3)}
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-1">
          {SLOT_LABELS.map((hour, slotIndex) => (
            <div key={slotIndex} className="grid grid-cols-[60px_repeat(7,1fr)] gap-1 items-center">
              <div className="text-right text-xs text-cypher-4-2-2 pr-2 tabular-nums">{hour}</div>
              {DISPLAY_ORDER.map((dayIndex) => {
                const status = getSlotStatus(dayIndex, slotIndex);
                return (
                  <button
                    key={dayIndex}
                    type="button"
                    className={cellVariants({ status })}
                    disabled={status === "CONFLICT"}
                    onClick={() => onToggleSlot?.(dayIndex, slotIndex)}
                    aria-pressed={status === "AVAILABLE"}
                    aria-label={`${status === "AVAILABLE" ? "Quitar" : "Marcar"} disponibilidad: ${DAY_LABELS[dayIndex]}, ${hour}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}