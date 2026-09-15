// Shapes puros de PANTALLA 6 (espejo del include de match.getById/getByIdPublic).

export interface PlayerRef {
  profile: { displayName: string; user: { image: string | null } };
}

export interface CallUpItem {
  id: string;
  playerId: string;
  teamId: string;
  isAbsent: boolean;
  notes: string | null;
  player: PlayerRef;
}

export interface PlayerStatItem {
  playerId: string;
  teamId: string;
  goals: number;
  blueCards: number;
  yellowCards: number;
  redCards: number;
  fouls: number;
  ownGoals: number;
  player: PlayerRef;
}

// ESPEJO del engine (match.ts EDITABLE_BLOCKERS). El front jamás ofrece lo que el
// engine rechaza: en POSTPONED las acciones siguen vivas (el código lo permite).
export const TERMINAL_MATCH_STATUS = ["FINISHED", "WALKOVER", "CANCELLED"] as const;