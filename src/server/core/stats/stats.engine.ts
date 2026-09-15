// src/server/core/stats/stats.engine.ts
import type { Prisma, PrismaClient } from "@prisma/client";
import { calcFairPlay } from "../../../domain/stats/fair-play";
import { sortStandings } from "../../../domain/standings/sort";

type PrismaTx = PrismaClient | Prisma.TransactionClient;

/**
 * Acumulador por equipo para la tabla de posiciones.
 * (Reemplaza el Map<string, any> original: mismo comportamiento, con tipos.)
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

export const statsEngine = {
  /**
   * Recalcula las estadísticas globales de un jugador basándose en sus últimos 10 partidos con stats.
   */
  async recalculatePlayerStats(tx: PrismaTx, playerId: string) {
    // 1. Obtener los últimos 10 partidos con stats del jugador
    const recentStats = await tx.matchPlayerStat.findMany({
      where: { playerId },
      include: { match: { include: { result: true } } },
      orderBy: { match: { scheduledAt: "desc" } },
      take: 10,
    });

    // 2. Calcular aggregates
    const totalGoals = recentStats.reduce((sum, s) => sum + s.goals, 0);
    const avgGoalsLast10 = recentStats.length > 0 ? totalGoals / recentStats.length : 0;
    const totalBlueCards = recentStats.reduce((sum, s) => sum + s.blueCards, 0);
    const totalYellowCards = recentStats.reduce((sum, s) => sum + s.yellowCards, 0);
    const totalRedCards = recentStats.reduce((sum, s) => sum + s.redCards, 0);
    const totalFouls = recentStats.reduce((sum, s) => sum + s.fouls, 0);

    // Fair Play según PROJECT_CONTEXT §7.8 — fórmula centralizada en src/domain/stats/fair-play.ts
    // (la MISMA que usa el cliente para el preview del form de resultado).
    // calcFairPlay ya devuelve 0 cuando matchesConsidered <= 0, no hace falta el ternario.
    const fairPlayScore = calcFairPlay(
      {
        yellowCards: totalYellowCards,
        redCards: totalRedCards,
        blueCards: totalBlueCards,
        fouls: totalFouls,
      },
      recentStats.length,
    );

    // 3. Contar total de partidos históricos con stats
    const matchesWithStats = await tx.matchPlayerStat.count({ where: { playerId } });

    // 4. Upsert en PlayerStats
    return tx.playerStats.upsert({
      where: { playerId },
      update: {
        matchesWithStats,
        totalGoals,
        avgGoalsLast10,
        totalBlueCardsLast10: totalBlueCards,
        totalYellowCardsLast10: totalYellowCards,
        totalRedCardsLast10: totalRedCards,
        totalFoulsLast10: totalFouls,
        fairPlayScore,
        lastCalculatedAt: new Date(),
      },
      create: {
        playerId,
        matchesWithStats,
        totalGoals,
        avgGoalsLast10,
        totalBlueCardsLast10: totalBlueCards,
        totalYellowCardsLast10: totalYellowCards,
        totalRedCardsLast10: totalRedCards,
        totalFoulsLast10: totalFouls,
        fairPlayScore,
      },
    });
  },

  /**
   * Recalcula las estadísticas globales de un equipo (PJ, PG, PE, PP, GF, GC).
   */
  async recalculateTeamStats(tx: PrismaTx, teamId: string) {
    const matches = await tx.match.findMany({
      where: {
        OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
        status: "FINISHED",
        result: { isNot: null },
      },
      include: { result: true },
    });

    let matchesPlayed = 0, matchesWon = 0, matchesDrawn = 0, matchesLost = 0;
    let goalsFor = 0, goalsAgainst = 0;

    for (const m of matches) {
      if (!m.result || m.result.isWalkover) continue; // Walkover no suma métricas numéricas

      matchesPlayed++;
      const isHome = m.homeTeamId === teamId;
      const myScore = isHome ? m.result.homeScore : m.result.awayScore;
      const oppScore = isHome ? m.result.awayScore : m.result.homeScore;

      goalsFor += myScore;
      goalsAgainst += oppScore;

      if (myScore > oppScore) matchesWon++;
      else if (myScore < oppScore) matchesLost++;
      else matchesDrawn++;
    }

    // Fair play del equipo: promedio del fairPlayScore de sus jugadores activos.
    // Escala: 0 = perfecto, más alto = peor (misma escala que jugador, §7.8).
    const playersStats = await tx.playerStats.findMany({
      where: { player: { teamMemberships: { some: { teamId, leftAt: null } } } }
    });
    const fairPlayScore = playersStats.length > 0
      ? playersStats.reduce((sum, p) => sum + p.fairPlayScore, 0) / playersStats.length
      : 0; // Sin partidos con stats → penalización cero (perfecto)

    return tx.teamStats.upsert({
      where: { teamId },
      update: {
        matchesPlayed, matchesWon, matchesDrawn, matchesLost,
        goalsFor, goalsAgainst, goalDifference: goalsFor - goalsAgainst,
        fairPlayScore, lastCalculatedAt: new Date(),
      },
      create: {
        teamId, matchesPlayed, matchesWon, matchesDrawn, matchesLost,
        goalsFor, goalsAgainst, goalDifference: goalsFor - goalsAgainst,
        fairPlayScore,
      },
    });
  },

  /**
   * Recalcula la tabla de posiciones de un torneo específico.
   */
  async recalculateTournamentStandings(tx: PrismaTx, tournamentId: string) {
    const matches = await tx.match.findMany({
      where: { tournamentId, status: "FINISHED", result: { isNot: null } },
      include: { result: true, playerStats: true },
    });

    // Agrupar por equipo (antes Map<string, any>)
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
      if (!m.result || !m.homeTeamId || !m.awayTeamId) continue;
      const { homeTeamId, awayTeamId, result } = m;

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
    }

    // Convertir a array, calcular DG y ordenar.
    // Criterio único centralizado en src/domain/standings/sort.ts:
    // Puntos ↓ → DG ↓ → GF ↓ → Fair Play ↑. No muta el original.
    const standings = sortStandings(
      Array.from(standingsMap.values()).map((s) => ({
        ...s,
        goalDifference: s.goalsFor - s.goalsAgainst,
      })),
    );

    // Upsert en DB con la posición calculada
    await Promise.all(standings.map((s, index) =>
      tx.tournamentStanding.upsert({
        where: { tournamentId_teamId: { tournamentId, teamId: s.teamId } },
        update: {
          position: index + 1,
          matchesPlayed: s.matchesPlayed, matchesWon: s.matchesWon, matchesDrawn: s.matchesDrawn, matchesLost: s.matchesLost,
          goalsFor: s.goalsFor, goalsAgainst: s.goalsAgainst, goalDifference: s.goalDifference,
          points: s.points, fairPlayScore: s.fairPlayScore,
        },
        create: {
          tournamentId, teamId: s.teamId, position: index + 1,
          matchesPlayed: s.matchesPlayed, matchesWon: s.matchesWon, matchesDrawn: s.matchesDrawn, matchesLost: s.matchesLost,
          goalsFor: s.goalsFor, goalsAgainst: s.goalsAgainst, goalDifference: s.goalDifference,
          points: s.points, fairPlayScore: s.fairPlayScore,
        },
      })
    ));
  }
};