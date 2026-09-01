import { cellVariants } from "./availability-matrix.variants";

interface AvailabilityMatrixProps {
  slots: {
    dayOfWeek: number;
    timeSlot: number;
    status: "AVAILABLE" | "UNAVAILABLE" | "CONFLICT";
  }[];
  onToggleSlot?: (dayOfWeek: number, timeSlot: number) => void;
}

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]; 
const HOURS = Array.from({ length: 12 }, (_, i) => `${i * 2}:00 - ${(i * 2 + 2) % 24}:00`);

export function AvailabilityMatrix({ slots, onToggleSlot }: AvailabilityMatrixProps) {
  const getSlotStatus = (day: number, slot: number) => {
    const found = slots.find((s) => s.dayOfWeek === day && s.timeSlot === slot);
    return found?.status ?? "UNAVAILABLE";
  };

  return (
    <div className="w-full overflow-x-auto pb-4">
      <div className="min-w-600px">
        <div className="grid grid-cols-[60px_repeat(7,1fr)] gap-1 mb-2">
          <div className="w-60px" />
          {DAYS.map((day) => (
            <div key={day} className="text-center text-xs font-bold uppercase text-zinc-400">
              {day}
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-1">
          {HOURS.map((hour, slotIndex) => (
            <div key={slotIndex} className="grid grid-cols-[60px_repeat(7,1fr)] gap-1 items-center">
              <div className="text-right text-xs text-zinc-500 pr-2">{hour}</div>
              {Array.from({ length: 7 }, (_, i) => {
                const dayIndex = i === 6 ? 0 : i + 1; 
                const status = getSlotStatus(dayIndex, slotIndex);
                return (
                  <button
                    key={dayIndex}
                    className={cellVariants({ status })}
                    disabled={status === "CONFLICT"}
                    onClick={() => onToggleSlot?.(dayIndex, slotIndex)}
                    aria-label={`Disponibilidad ${DAYS[i]} a las ${hour}`}
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