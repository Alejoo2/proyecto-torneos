export interface SortableStanding {
  points: number;
  goalsFor: number;
  goalDifference: number;
  fairPlayScore: number;
}

/**
 * Único criterio de ordenamiento (idéntico al de stats.engine):
 * 1. Puntos ↓ · 2. DG ↓ · 3. GF ↓ · 4. Fair Play ↑ (menos penalización arriba)
 */
export function compareStandings(a: SortableStanding, b: SortableStanding): number {
  if (b.points !== a.points) return b.points - a.points;
  if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
  if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
  return a.fairPlayScore - b.fairPlayScore;
}

/** No muta el original */
export function sortStandings<T extends SortableStanding>(rows: T[]): T[] {
  return [...rows].sort(compareStandings);
}