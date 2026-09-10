/**
 * Constantes y helpers compartidos del Hub (server + client).
 */

/** Estados de torneo que el Hub considera activos */
export const ACTIVE_TOURNAMENT_STATUSES = [
  "SCHEDULED",
  "GRACE_PERIOD",
  "IN_PROGRESS",
] as const;

/** 12 franjas de 2h: slot 0 = 00:00–02:00 … slot 11 = 22:00–24:00 */
export const SLOTS_PER_DAY = 12;

/** Vista inicial del mapa (corredor Sogamoso–Nobsa) */
export const HUB_CENTER: [number, number] = [5.74, -72.89];
export const HUB_ZOOM = 14;
export const HUB_BOUNDS: [number, number][] = [
  [5.67, -72.98], // SO (Sogamoso)
  [5.79, -72.82], // NE (Nobsa)
];

/** "08:00–10:00" */
export function slotToLabel(slot: number): string {
  const start = slot * 2;
  const end = start + 2;
  return `${String(start).padStart(2, "0")}:00–${String(end).padStart(2, "0")}:00`;
}

/** Indexado por dayOfWeek (0 = domingo, convención confirmada) */
export const DAY_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"] as const;