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
  const phases: { name: string; order: number }[] = [];
  const rounds = Math.log2(teamCount);
  const phaseNames = ["Final", "Semifinal", "Cuartos de Final", "Octavos de Final", "Dieciseisavos de Final"];

  for (let i = 0; i < rounds; i++) {
    phases.push({
      name: phaseNames[i] ?? `Ronda ${rounds - i}`,
      order: rounds - i,
    });
  }
  return phases.reverse(); // Ordenar de primera ronda a final
}

/** Próxima ocurrencia del dayOfWeek (0=domingo) desde una fecha, medianoche UTC.
 *  Si la fecha ya cae ese día, devuelve la misma fecha (la reserva incluye hoy). */
export function nextWeekdayUTC(from: Date, dayOfWeek: number): Date {
  const d = new Date(from);
  d.setUTCHours(0, 0, 0, 0);
  const diff = (dayOfWeek - d.getUTCDay() + 7) % 7;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}