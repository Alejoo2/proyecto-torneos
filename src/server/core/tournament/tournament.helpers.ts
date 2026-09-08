// server/core/tournament/tournament.helpers.ts

export function fisherYatesShuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = shuffled[i] as T;
    shuffled[i] = shuffled[j] as T;
    shuffled[j] = temp;
  }
  return shuffled;
}

export function generateEliminationPhases(teamCount: number): { name: string; order: number }[] {
  const phases = [];
  const rounds = Math.log2(teamCount);
  const phaseNames = ["Final", "Semifinal", "Cuartos de Final", "Octavos de Final", "Dieciseisavos de Final"];

  for (let i = 0; i < rounds; i++) {
    phases.push({
      name: phaseNames[i] ?? `Ronda ${rounds - i}`,
      order: i + 1,
    });
  }
  return phases.reverse(); // Ordenar de primera ronda a final
}