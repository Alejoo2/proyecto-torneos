export interface DrawSlot {
  phaseOrder: number;
  matchNumberInPhase: number;
  homeTeamId?: string;
  awayTeamId?: string;
}

/**
 * Genera la estructura de partidos para un torneo eliminatorio.
 * Crea los partidos de la fase 1 con sus equipos, y los partidos de fases subsiguientes vacíos.
 */
export function generateMatchesForElimination(shuffledTeams: { id: string }[]): DrawSlot[] {
  const slots: DrawSlot[] = [];
  const totalTeams = shuffledTeams.length;
  const totalPhases = Math.log2(totalTeams);
  
  let matchesInCurrentPhase = totalTeams / 2;

  for (let phaseOrder = 1; phaseOrder <= totalPhases; phaseOrder++) {
    for (let i = 0; i < matchesInCurrentPhase; i++) {
      if (phaseOrder === 1) {
        // Fase 1: asignar equipos reales
        const home = shuffledTeams[i * 2]?.id;
        const away = shuffledTeams[i * 2 + 1]?.id;
        slots.push({
          phaseOrder,
          matchNumberInPhase: i + 1,
          homeTeamId: home,
          awayTeamId: away,
        });
      } else {
        // Fases subsiguientes: vacíos
        slots.push({
          phaseOrder,
          matchNumberInPhase: i + 1,
        });
      }
    }
    matchesInCurrentPhase = matchesInCurrentPhase / 2;
  }

  return slots;
}