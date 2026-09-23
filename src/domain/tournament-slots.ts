/**
 * W11 — E5: regla del dueño — "por partido es 1 franja" (eliminación directa,
 * bracket de potencia de 2 → N equipos juegan N−1 partidos). 4→3 · 8→7 · 16→15.
 * Función pura: si el criterio cambia, cambia aquí (1 línea, decisión cerrada W11).
 */
export function requiredSlotCount(maxTeams: number): number {
  return Math.max(0, maxTeams - 1);
}