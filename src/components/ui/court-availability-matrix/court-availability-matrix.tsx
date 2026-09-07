import { courtCellVariants } from "./court-availability-matrix.variants";

interface CourtAvailabilityMatrixProps {
  startDate: Date;
  slots: {
    date: Date;
    timeSlot: number;
    status: "AVAILABLE" | "UNAVAILABLE";
  }[];
  isCourtDisabled?: boolean;
  isReadOnly?: boolean; // Nuevo: para Gestores/Jugadores
  onToggleSlot?: (date: Date, timeSlot: number) => void;
  onCloseDay?: (date: Date) => void; // Nuevo: Botón de cerrar día
}

const HOURS = Array.from({ length: 12 }, (_, i) => `${i * 2}:00`);

export function CourtAvailabilityMatrix({ 
  startDate, 
  slots, 
  isCourtDisabled = false, 
  isReadOnly = false,
  onToggleSlot,
  onCloseDay
}: CourtAvailabilityMatrixProps) {
  
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(startDate);
    d.setUTCDate(startDate.getUTCDate() + i);
    return d;
  });

  const getSlotStatus = (date: Date, slot: number) => {
    const found = slots.find(
      (s) => s.date.toISOString() === date.toISOString() && s.timeSlot === slot
    );
    return found?.status ?? "UNAVAILABLE";
  };

  return (
    <div className="w-full overflow-x-auto pb-4">
      <div className="min-w-[800px]">
        {/* Header Días */}
        <div className="grid grid-cols-[60px_repeat(14,1fr)] gap-1 mb-2">
          <div className="w-[60px]" />
          {days.map((day, i) => (
            <div key={i} className="text-center flex flex-col items-center gap-1">
              <p className="text-[10px] font-bold uppercase text-zinc-400">
                {day.toLocaleDateString("es-CO", { weekday: "short" })}
              </p>
              <p className="text-xs text-zinc-600 font-medium">
                {day.getUTCDate()}/{day.getUTCMonth() + 1}
              </p>
              {!isReadOnly && onCloseDay && (
                <button 
                  className="text-[9px] text-red-500 hover:text-red-700 font-medium"
                  onClick={() => onCloseDay(day)}
                >
                  Cerrar
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Filas de Horarios */}
        <div className="flex flex-col gap-1">
          {HOURS.map((hour, slotIndex) => (
            <div key={slotIndex} className="grid grid-cols-[60px_repeat(14,1fr)] gap-1 items-center">
              <div className="text-right text-[10px] text-zinc-500 pr-2">{hour}</div>
              {days.map((day, dayIndex) => {
                const status = getSlotStatus(day, slotIndex);
                const isDisabled = isCourtDisabled || isReadOnly;
                return (
                  <button
                    key={dayIndex}
                    className={courtCellVariants({ 
                      status: isCourtDisabled ? "DISABLED" : status 
                    })}
                    disabled={isDisabled}
                    onClick={() => onToggleSlot?.(day, slotIndex)}
                    aria-label={`Franja ${day.toLocaleDateString()} a las ${hour}`}
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