import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { calcFairPlay } from "../../../domain/stats/fair-play";
import { sortStandings } from "../../../domain/standings/sort";

type PrismaTx = PrismaClient | Prisma.TransactionClient;

/**
 * Acumulador por equipo para la tabla de posiciones.
 */
interface StandingAccumulator {
  teamId: string;
  matchesPlayed: number;
  matchesWon: number;
  matchesDrawn: number;
  matchesLost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  fairPlayScore: number;
}

const newAccumulator = (teamId: string): StandingAccumulator => ({
  teamId,
  matchesPlayed: 0,
  matchesWon: 0,
  matchesDrawn: 0,
  matchesLost: 0,
  goalsFor: 0,
  goalsAgainst: 0,
  points: 0,
  fairPlayScore: 0,
});

// ─── Filas de escritura (shape exacto de columnas de cada tabla) ───

interface PlayerStatWrite {
  playerId: string;
  matchesWithStats: number;
  totalGoals: number;
  avgGoalsLast10: number;
  totalBlueCardsLast10: number;
  totalYellowCardsLast10: number;
  totalRedCardsLast10: number;
  totalFoulsLast10: number;
  fairPlayScore: number;
}

interface TeamStatWrite {
  teamId: string;
  matchesPlayed: number;
  matchesWon: number;
  matchesDrawn: number;
  matchesLost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  fairPlayScore: number;
}

interface StandingWrite {
  teamId: string;
  position: number;
  matchesPlayed: number;
  matchesWon: number;
  matchesDrawn: number;
  matchesLost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  fairPlayScore: number;
}

interface MatchResultShape {
  homeScore: number;
  awayScore: number;
  isWalkover: boolean;
}

/**
 * D-1 v2 (macro-query): los ids de estas tablas son `@default(cuid())` generados
 * por el CLIENTE de Prisma → el DDL no tiene DEFAULT → el INSERT crudo debe
 * supply el id. randomUUID() es válido (columna String, sin validación de formato).
 * Divergencia cosmética documentada: ids nuevos = uuid en vez de cuid.
 */
const newId = (): string => randomUUID();

export const statsEngine = {
  /**
   * D-1 v2 — Versión batch de recalculatePlayerStats. Mismas fórmulas verbatim
   * (últimos 10 por scheduledAt desc sin desempate — igual que el original—,
   * promedios, fairPlay vía calcFairPlay, matchesWithStats = count histórico).
   * 2 viajes en total (1 findMany + 1 bulk upsert) en vez de 3 por jugador.
   */
  async recalculatePlayerStatsBatch(tx: PrismaTx, playerIds: string[]) {
    const ids = [...new Set(playerIds)];
    if (ids.length === 0) return;

    // ÚNICO viaje de lectura: historia completa de los jugadores involucrados.
    // (El include { match: { include: { result } } } del original no usaba result: peso muerto.)
    const rows = await tx.matchPlayerStat.findMany({
      where: { playerId: { in: ids } },
      select: {
        playerId: true,
        goals: true,
        blueCards: true,
        yellowCards: true,
        redCards: true,
        fouls: true,
        match: { select: { scheduledAt: true } },
      },
    });

    // Agrupar por jugador
    const byPlayer = new Map<string, typeof rows>();
    for (const r of rows) {
      let list = byPlayer.get(r.playerId);
      if (!list) {
        list = [];
        byPlayer.set(r.playerId, list);
      }
      list.push(r);
    }

    const values: PlayerStatWrite[] = [];

    for (const playerId of ids) {
      const all = byPlayer.get(playerId) ?? [];

      // "Últimos 10" verbatim: orden por scheduledAt desc, SIN desempate
      // (el orderBy original tampoco garantizaba orden en empates de fecha).
      const recent = [...all]
      // scheduledAt nullable: ?? Infinity replica el NULLS FIRST de Postgres en DESC (orderBy original).
        .sort((a, b) => (b.match.scheduledAt?.getTime() ?? Number.POSITIVE_INFINITY) - (a.match.scheduledAt?.getTime() ?? Number.POSITIVE_INFINITY))
        .slice(0, 10);

      const totalGoals = recent.reduce((sum, s) => sum + s.goals, 0);
      const avgGoalsLast10 = recent.length > 0 ? totalGoals / recent.length : 0;
      const totalBlueCards = recent.reduce((sum, s) => sum + s.blueCards, 0);
      const totalYellowCards = recent.reduce((sum, s) => sum + s.yellowCards, 0);
      const totalRedCards = recent.reduce((sum, s) => sum + s.redCards, 0);
      const totalFouls = recent.reduce((sum, s) => sum + s.fouls, 0);

      // Fair Play §7.8 — misma función centralizada que usa el cliente (import intacto).
      const fairPlayScore = calcFairPlay(
        {
          yellowCards: totalYellowCards,
          redCards: totalRedCards,
          blueCards: totalBlueCards,
          fouls: totalFouls,
        },
        recent.length,
      );

      values.push({
        playerId,
        matchesWithStats: all.length, // count histórico (sale gratis del mismo findMany)
        totalGoals,
        avgGoalsLast10,
        totalBlueCardsLast10: totalBlueCards,
        totalYellowCardsLast10: totalYellowCards,
        totalRedCardsLast10: totalRedCards,
        totalFoulsLast10: totalFouls,
        fairPlayScore,
      });
    }

    const now = new Date();
    const rowsSql = values.map((v) =>
      Prisma.sql`(${newId()}, ${v.playerId}, ${v.matchesWithStats}, ${v.totalGoals}, ${v.avgGoalsLast10}, ${v.totalBlueCardsLast10}, ${v.totalYellowCardsLast10}, ${v.totalRedCardsLast10}, ${v.totalFoulsLast10}, ${v.fairPlayScore}, ${now})`,
    );

    // ÚNICO viaje de escritura: bulk upsert parametrizado.
    await tx.$executeRaw`
      INSERT INTO "PlayerStats"
        ("id", "playerId", "matchesWithStats", "totalGoals", "avgGoalsLast10",
         "totalBlueCardsLast10", "totalYellowCardsLast10", "totalRedCardsLast10",
         "totalFoulsLast10", "fairPlayScore", "lastCalculatedAt")
      VALUES ${Prisma.join(rowsSql)}
      ON CONFLICT ("playerId") DO UPDATE SET
        "matchesWithStats" = EXCLUDED."matchesWithStats",
        "totalGoals" = EXCLUDED."totalGoals",
        "avgGoalsLast10" = EXCLUDED."avgGoalsLast10",
        "totalBlueCardsLast10" = EXCLUDED."totalBlueCardsLast10",
        "totalYellowCardsLast10" = EXCLUDED."totalYellowCardsLast10",
        "totalRedCardsLast10" = EXCLUDED."totalRedCardsLast10",
        "totalFoulsLast10" = EXCLUDED."totalFoulsLast10",
        "fairPlayScore" = EXCLUDED."fairPlayScore",
        "lastCalculatedAt" = EXCLUDED."lastCalculatedAt"
    `;
  },

  /**
   * D-1 v2 — Versión batch de recalculateTeamStats. Mismo loop verbatim
   * (skip walkover, score compare), fair play = promedio del fairPlayScore
   * de jugadores con membresía activa (jugador en dos equipos cuenta para ambos,
   * igual que hoy). 4 viajes en vez de 3 por equipo.
   */
  async recalculateTeamStatsBatch(tx: PrismaTx, teamIds: string[]) {
    const ids = [...new Set(teamIds)];
    if (ids.length === 0) return;

    // Viaje 1: partidos FINISHED con resultado de ambos equipos en una query.
    const matches = await tx.match.findMany({
      where: {
        OR: [{ homeTeamId: { in: ids } }, { awayTeamId: { in: ids } }],
        status: "FINISHED",
        result: { isNot: null },
      },
      select: {
        homeTeamId: true,
        awayTeamId: true,
        result: { select: { homeScore: true, awayScore: true, isWalkover: true } },
      },
    });

    const idSet = new Set(ids);
    const acc = new Map<string, TeamStatWrite>();
    for (const teamId of ids) {
      acc.set(teamId, {
        teamId,
        matchesPlayed: 0,
        matchesWon: 0,
        matchesDrawn: 0,
        matchesLost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        fairPlayScore: 0,
      });
    }

    for (const m of matches) {
      const result: MatchResultShape | null = m.result;
      if (!result || result.isWalkover) continue; // Walkover no suma métricas numéricas

      for (const teamId of [m.homeTeamId, m.awayTeamId]) {
        if (!teamId || !idSet.has(teamId)) continue;
        const a = acc.get(teamId);
        if (!a) continue;

        const isHome = m.homeTeamId === teamId;
        const myScore = isHome ? result.homeScore : result.awayScore;
        const oppScore = isHome ? result.awayScore : result.homeScore;

        a.matchesPlayed++;
        a.goalsFor += myScore;
        a.goalsAgainst += oppScore;

        if (myScore > oppScore) a.matchesWon++;
        else if (myScore < oppScore) a.matchesLost++;
        else a.matchesDrawn++;
      }
    }

    // Viaje 2: membresías activas de todos los equipos.
    // (2a/2b separados a propósito: la back-relation Player→PlayerStats tiene nombre
    // no verificado; findMany sobre teamMembership + playerStats usa solo nombres conocidos.)
    const memberships = await tx.teamMembership.findMany({
      where: { teamId: { in: ids }, leftAt: null },
      select: { teamId: true, playerId: true },
    });

    // Viaje 3: fair play de esos jugadores.
    const memberPlayerIds = [...new Set(memberships.map((m) => m.playerId))];
    const statsRows =
      memberPlayerIds.length > 0
        ? await tx.playerStats.findMany({
            where: { playerId: { in: memberPlayerIds } },
            select: { playerId: true, fairPlayScore: true },
          })
        : [];
    const fairPlayByPlayer = new Map(statsRows.map((s) => [s.playerId, s.fairPlayScore]));

    // Agrupar memberships por equipo con Set (evita doble conteo defensivo)
    const playersByTeam = new Map<string, Set<string>>();
    for (const m of memberships) {
      let set = playersByTeam.get(m.teamId);
      if (!set) {
        set = new Set();
        playersByTeam.set(m.teamId, set);
      }
      set.add(m.playerId);
    }

    // Promedio verbatim: sin fila de stats → no cuenta en denominador; sin jugadores → 0.
    for (const teamId of ids) {
      const a = acc.get(teamId);
      if (!a) continue;
      const players = playersByTeam.get(teamId);
      if (players && players.size > 0) {
        let sum = 0;
        for (const pid of players) {
          sum += fairPlayByPlayer.get(pid) ?? 0;
        }
        // Jugadores con membresía activa pero SIN fila PlayerStats no cuentan
        // en el denominador (igual que el findMany sobre PlayerStats del original).
        const counted = [...players].filter((pid) => fairPlayByPlayer.has(pid)).length;
        a.fairPlayScore = counted > 0 ? sum / counted : 0;
      } else {
        a.fairPlayScore = 0;
      }
      a.goalDifference = a.goalsFor - a.goalsAgainst;
    }

    const now = new Date();
    const rowsSql = [...acc.values()].map((v) =>
      Prisma.sql`(${newId()}, ${v.teamId}, ${v.matchesPlayed}, ${v.matchesWon}, ${v.matchesDrawn}, ${v.matchesLost}, ${v.goalsFor}, ${v.goalsAgainst}, ${v.goalDifference}, ${v.fairPlayScore}, ${now})`,
    );
    if (rowsSql.length === 0) return;

    // Viaje 4: bulk upsert.
    await tx.$executeRaw`
      INSERT INTO "TeamStats"
        ("id", "teamId", "matchesPlayed", "matchesWon", "matchesDrawn", "matchesLost",
         "goalsFor", "goalsAgainst", "goalDifference", "fairPlayScore", "lastCalculatedAt")
      VALUES ${Prisma.join(rowsSql)}
      ON CONFLICT ("teamId") DO UPDATE SET
        "matchesPlayed" = EXCLUDED."matchesPlayed",
        "matchesWon" = EXCLUDED."matchesWon",
        "matchesDrawn" = EXCLUDED."matchesDrawn",
        "matchesLost" = EXCLUDED."matchesLost",
        "goalsFor" = EXCLUDED."goalsFor",
        "goalsAgainst" = EXCLUDED."goalsAgainst",
        "goalDifference" = EXCLUDED."goalDifference",
        "fairPlayScore" = EXCLUDED."fairPlayScore",
        "lastCalculatedAt" = EXCLUDED."lastCalculatedAt"
    `;
  },

  /**
   * Recalcula la tabla de posiciones de un torneo específico. (Nombre conservado:
   * ya era una llamada por torneo; solo se reemplazan los N upserts por 1 bulk.)
   */
  async recalculateTournamentStandings(tx: PrismaTx, tournamentId: string) {
    // Include playerStats del original eliminado: no se leía (peso muerto verificado).
    const matches = await tx.match.findMany({
      where: { tournamentId, status: "FINISHED", result: { isNot: null } },
      select: {
        homeTeamId: true,
        awayTeamId: true,
        result: { select: { homeScore: true, awayScore: true, isWalkover: true } },
      },
    });

    const standingsMap = new Map<string, StandingAccumulator>();
    const ensureTeam = (teamId: string): StandingAccumulator => {
      let s = standingsMap.get(teamId);
      if (!s) {
        s = newAccumulator(teamId);
        standingsMap.set(teamId, s);
      }
      return s;
    };

    for (const m of matches) {
      const result = m.result;
      if (!result || !m.homeTeamId || !m.awayTeamId) continue;
      const { homeTeamId, awayTeamId } = m;

      const home = ensureTeam(homeTeamId);
      const away = ensureTeam(awayTeamId);

      if (!result.isWalkover) {
        home.matchesPlayed++; away.matchesPlayed++;
        home.goalsFor += result.homeScore; home.goalsAgainst += result.awayScore;
        away.goalsFor += result.awayScore; away.goalsAgainst += result.homeScore;

        if (result.homeScore > result.awayScore) {
          home.matchesWon++; home.points += 3;
          away.matchesLost++;
        } else if (result.homeScore < result.awayScore) {
          away.matchesWon++; away.points += 3;
          home.matchesLost++;
        } else {
          home.matchesDrawn++; away.matchesDrawn++;
          home.points++; away.points++;
        }
      }
      // Quirk preservado verbatim: fairPlayScore del acumulador queda en 0
      // (nadie lo actualiza, igual que el original) → el criterio fair-play
      // de sortStandings hoy es neutro. Deuda de engine registrada.
    }

    // Criterio único centralizado: Puntos ↓ → DG ↓ → GF ↓ → Fair Play ↑.
    const standings: StandingWrite[] = sortStandings(
      Array.from(standingsMap.values()).map((s) => ({
        ...s,
        goalDifference: s.goalsFor - s.goalsAgainst,
      })),
    ).map((s, index) => ({
      teamId: s.teamId,
      position: index + 1,
      matchesPlayed: s.matchesPlayed,
      matchesWon: s.matchesWon,
      matchesDrawn: s.matchesDrawn,
      matchesLost: s.matchesLost,
      goalsFor: s.goalsFor,
      goalsAgainst: s.goalsAgainst,
      goalDifference: s.goalDifference,
      points: s.points,
      fairPlayScore: s.fairPlayScore,
    }));

    if (standings.length === 0) return;

    const now = new Date();
    const rowsSql = standings.map((s) =>
      Prisma.sql`(${newId()}, ${tournamentId}, ${s.teamId}, ${s.position}, ${s.matchesPlayed}, ${s.matchesWon}, ${s.matchesDrawn}, ${s.matchesLost}, ${s.goalsFor}, ${s.goalsAgainst}, ${s.goalDifference}, ${s.points}, ${s.fairPlayScore}, ${now})`,
    );

    // updatedAt seteado explícito: @updatedAt es resuelto por el cliente de Prisma,
    // que $executeRaw bypassa.
    await tx.$executeRaw`
      INSERT INTO "TournamentStanding"
        ("id", "tournamentId", "teamId", "position", "matchesPlayed", "matchesWon",
         "matchesDrawn", "matchesLost", "goalsFor", "goalsAgainst", "goalDifference",
         "points", "fairPlayScore", "updatedAt")
      VALUES ${Prisma.join(rowsSql)}
      ON CONFLICT ("tournamentId", "teamId") DO UPDATE SET
        "position" = EXCLUDED."position",
        "matchesPlayed" = EXCLUDED."matchesPlayed",
        "matchesWon" = EXCLUDED."matchesWon",
        "matchesDrawn" = EXCLUDED."matchesDrawn",
        "matchesLost" = EXCLUDED."matchesLost",
        "goalsFor" = EXCLUDED."goalsFor",
        "goalsAgainst" = EXCLUDED."goalsAgainst",
        "goalDifference" = EXCLUDED."goalDifference",
        "points" = EXCLUDED."points",
        "fairPlayScore" = EXCLUDED."fairPlayScore",
        "updatedAt" = EXCLUDED."updatedAt"
    `;
  },
};