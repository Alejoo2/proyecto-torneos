import { DAY_LABELS, SLOT_GRID_HEADERS } from "torneos/domain/schedule/labels";
import { cellVariants } from "./availability-matrix.variants";
import { SlotGrid } from "./slot-grid";

interface AvailabilityMatrixProps {
  slots: {
    dayOfWeek: number;
    timeSlot: number;
    status: "AVAILABLE" | "UNAVAILABLE" | "CONFLICT" | "SUGGESTED" | "HARD_CONFLICT";
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
  // Regla amarilla: lo SUGERIDO se puede tocar (pasar a verde); el ROJO jamás.
  const isLocked = (status: string) => status === "HARD_CONFLICT" || status === "CONFLICT";

  return (
    <div className="w-full overflow-x-auto pb-4">
        <SlotGrid
          columns={[...SLOT_GRID_HEADERS]}
          rows={DISPLAY_ORDER.map((dayIndex) => ({
            key: String(dayIndex),
            label: DAY_LABELS[dayIndex]?.slice(0, 3) ?? "",
            cells: Array.from({ length: 12 }, (_, slotIndex) => {
              const status = getSlotStatus(dayIndex, slotIndex);
              const locked = isLocked(status);
              return (
                <button
                  key={slotIndex}
                  type="button"
                  className={cellVariants({ status })}
                  disabled={locked}
                  onClick={() => {
                    if (!locked) onToggleSlot?.(dayIndex, slotIndex);
                  }}
                  aria-pressed={status === "AVAILABLE"}
                  aria-label={`${status === "AVAILABLE" ? "Quitar" : "Marcar"} disponibilidad: ${DAY_LABELS[dayIndex]}, ${SLOT_GRID_HEADERS[slotIndex]}`}
                />
              );
            }),
          }))}
        />
    </div>
  );
}