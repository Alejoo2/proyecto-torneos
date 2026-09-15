export const FAIR_PLAY_WEIGHTS = {
  yellow: 1,
  red: 3,
  blue: 0.5,
  foul: 0.25,
} as const;

export interface FairPlayCounters {
  yellowCards: number;
  redCards: number;
  blueCards: number;
  fouls: number;
}

/**
 * Fórmula corregida (B-07) — PROJECT_CONTEXT §7.8:
 * (amarillas×1 + rojas×3 + azules×0.5 + faltas×0.25) / partidosConsiderados
 * Escala: 0 = perfecto · más alto = peor. Métrica informativa.
 */
export function calcFairPlay(counters: FairPlayCounters, matchesConsidered: number): number {
  if (matchesConsidered <= 0) return 0;
  const penalty =
    counters.yellowCards * FAIR_PLAY_WEIGHTS.yellow +
    counters.redCards * FAIR_PLAY_WEIGHTS.red +
    counters.blueCards * FAIR_PLAY_WEIGHTS.blue +
    counters.fouls * FAIR_PLAY_WEIGHTS.foul;
  return penalty / matchesConsidered;
}

/** Suma contadores crudos (para el preview del form de resultado) */
export function sumCounters(rows: FairPlayCounters[]): FairPlayCounters {
  return rows.reduce(
    (acc, r) => ({
      yellowCards: acc.yellowCards + r.yellowCards,
      redCards: acc.redCards + r.redCards,
      blueCards: acc.blueCards + r.blueCards,
      fouls: acc.fouls + r.fouls,
    }),
    { yellowCards: 0, redCards: 0, blueCards: 0, fouls: 0 },
  );
}