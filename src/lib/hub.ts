/**
 * Constantes y helpers compartidos del Hub (server + client).
 */
import type { TournamentStatus, TournamentType } from "@prisma/client";

/** Estados de torneo que el Hub considera activos */
export const ACTIVE_TOURNAMENT_STATUSES = [
  "SCHEDULED",
  "GRACE_PERIOD",
  "IN_PROGRESS",
] as const;

/**
 * Regla de vitrina anónima — ÚNICA fuente en el codebase.
 * Engines y routers filtran con esto; ni cliente ni servidor duplican el filtro.
 * La anotación valida en compile-time que los statuses existen en el enum.
 */
export const VITRINE_TOURNAMENT_WHERE: {
  type: TournamentType;
  status: { in: TournamentStatus[] };
} = {
  type: "PUBLIC",
  status: { in: [...ACTIVE_TOURNAMENT_STATUSES] },
};

/** Predicado JS derivado del where de arriba (para filtros en memoria). */
export function isVitrineTournament(input: {
  type: string;
  status: string;
}): boolean {
  return (
    input.type === VITRINE_TOURNAMENT_WHERE.type &&
    (VITRINE_TOURNAMENT_WHERE.status.in as readonly string[]).includes(
      input.status,
    )
  );
}

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