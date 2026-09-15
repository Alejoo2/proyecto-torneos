// Única fuente de vocabulario de estadísticas (espejo del zod de result.load y del
// modelo MatchPlayerStat). El dominio define; la UI solo etiqueta.
export type StatFieldKey =
  | "goals"
  | "blueCards"
  | "yellowCards"
  | "redCards"
  | "fouls"
  | "ownGoals";

export interface StatFieldMeta {
  field: StatFieldKey;
  short: string;       // columnas compactas (ResultReadout)
  label: string;       // panel de carga (cabe completo en 3-col)
  description: string; // tooltip enhancement (hover / long-press, wave futura)
}

export const STAT_FIELDS: StatFieldMeta[] = [
  { field: "goals", short: "GO", label: "Goles", description: "Goles anotados a favor de su equipo" },
  { field: "blueCards", short: "AZ", label: "T. azul", description: "Tarjeta azul: exclusión temporal por infracción" },
  { field: "yellowCards", short: "AM", label: "T. amarilla", description: "Amonestación" },
  { field: "redCards", short: "RO", label: "T. roja", description: "Expulsión del partido" },
  { field: "fouls", short: "FA", label: "Faltas", description: "Infracciones cometidas" },
  { field: "ownGoals", short: "OG", label: "Autogol", description: "Gol en propia arco: suma al marcador del rival" },
];

// Comprobación de coherencia: los autogoles del RIVAL suman al marcador propio.
export function expectedGoals(
  teamId: string,
  rivalTeamId: string,
  rows: { teamId: string; goals: number; ownGoals: number }[],
): number {
  return rows.reduce(
    (acc, r) =>
      acc + (r.teamId === teamId ? r.goals : 0) + (r.teamId === rivalTeamId ? r.ownGoals : 0),
    0,
  );
}