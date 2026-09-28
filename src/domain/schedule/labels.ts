// W2 — Etiquetas de agenda. Fuente única (DRY) para días y franjas de 2h.
// W5 — Se exponen los arreglos base: antes estaban duplicados en componentes.

export const DAY_LABELS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
] as const;

export const SLOT_LABELS = [
  "00:00 - 02:00",
  "02:00 - 04:00",
  "04:00 - 06:00",
  "06:00 - 08:00",
  "08:00 - 10:00",
  "10:00 - 12:00",
  "12:00 - 14:00",
  "14:00 - 16:00",
  "16:00 - 18:00",
  "18:00 - 20:00",
  "20:00 - 22:00",
  "22:00 - 00:00",
] as const;

export function dayLabel(dayOfWeek: number): string {
  return DAY_LABELS[dayOfWeek] ?? "";
}

// Etiqueta corta para filas de matriz (celdas pegadas): "0-2am", …, "10-12am".
export const SLOT_LABELS_SHORT = [
  "0-2am",
  "2-4am",
  "4-6am",
  "6-8am",
  "8-10am",
  "10-12pm",
  "12-2pm",
  "2-4pm",
  "4-6pm",
  "6-8pm",
  "8-10pm",
  "10-12am",
] as const;

export function slotLabel(timeSlot: number): string {
  return SLOT_LABELS[timeSlot] ?? "";
}

// Cabeceras de grilla unificada (estilo detalle cancha): "2hr"…"24hr".
export const SLOT_GRID_HEADERS: string[] = Array.from({ length: 12 }, (_, i) => `${(i + 1) * 2}hr`);