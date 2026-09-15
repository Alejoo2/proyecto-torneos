import { slotLabel } from "torneos/domain/schedule/labels";

// "Cuándo" de un partido. El engine normaliza `date` a medianoche UTC (H4) y la
// referencia horaria real es `timeSlot` (índice entero de SLOTS). El formateo SIEMPRE
// fija timeZone "America/Bogota": determinista SSR/cliente, sin offset en UTC-5.
export interface MatchWhen {
  scheduledAt?: Date | string | null;
  date?: Date | string | null;
  timeSlot?: number | null;
}

export function whenLabel(m: MatchWhen): string | null {
  if (m.scheduledAt) {
    return new Date(m.scheduledAt).toLocaleString("es-CO", {
      weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
      timeZone: "America/Bogota",
    });
  }
  if (m.date) {
    const day = new Date(m.date).toLocaleDateString("es-CO", {
      weekday: "short", day: "numeric", month: "short", timeZone: "America/Bogota",
    });
    const slot = m.timeSlot != null ? slotLabel(m.timeSlot) : "";
    return slot ? `${day} · ${slot}` : day;
  }
  return null;
}