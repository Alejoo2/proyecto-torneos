import type { PrismaClient } from "@prisma/client";
import { NotificationFamily, NotificationType } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { statsEngine } from "./stats.engine";
import { notificationEngine } from "../notification/notification.engine";
import { getMatchForManagerAction } from "torneos/server/core/match/match.engine";

interface PlayerStatInput {
  playerId: string;
  teamId: string;
  goals: number;
  blueCards: number;
  yellowCards: number;
  redCards: number;
  fouls: number;
  ownGoals: number;
}

export const resultEngine = {
  async loadResult(
    db: PrismaClient,
    matchId: string,
    homeScore: number,
    awayScore: number,
    playerStats: PlayerStatInput[],
    userId: string
  ) {
        return db.$transaction(async (tx) => {
      // W11 — E3/H-2: ownership (gestor o delegado) antes de CUALQUIER escritura.
      await getMatchForManagerAction(tx, matchId, userId);
      const match = await tx.match.findUnique({
        where: { id: matchId },
        include: { tournament: true, phase: true }
      });

      if (!match) throw new TRPCError({ code: "NOT_FOUND", message: "Partido no encontrado" });
      if (match.status === "FINISHED" || match.status === "WALKOVER") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "El partido ya tiene un resultado cargado" });
      }

      // 1. Determinar ganador
      let winnerId: string | null = null;
      if (homeScore > awayScore) winnerId = match.homeTeamId;
      else if (awayScore > homeScore) winnerId = match.awayTeamId;

      // 2. Crear MatchResult
      await tx.matchResult.create({
        data: {
          matchId, homeScore, awayScore, winnerId,
          isWalkover: false, loadedBy: userId,
        }
      });

      // 3. Crear MatchPlayerStat (si no es walkover)
      if (playerStats.length > 0) {
        await tx.matchPlayerStat.createMany({
          data: playerStats.map(ps => ({ matchId, ...ps }))
        });
      }

      // 4. Actualizar estado del partido
      await tx.match.update({
        where: { id: matchId },
        data: { status: "FINISHED" }
      });

      // 5. Avance automático en eliminatoria
      if (match.tournament.format === "SINGLE_ELIMINATION" && winnerId) {
        const nextPhase = await tx.tournamentPhase.findFirst({
          where: { tournamentId: match.tournamentId, order: match.phase.order + 1 }
        });

        if (nextPhase) {
          const currentPhaseMatches = await tx.match.findMany({
            where: { phaseId: match.phaseId },
            orderBy: { createdAt: "asc" }
          });

          const matchIndex = currentPhaseMatches.findIndex(m => m.id === matchId);
          const nextMatchIndex = Math.floor(matchIndex / 2);

          const nextMatches = await tx.match.findMany({
            where: { phaseId: nextPhase.id },
            orderBy: { createdAt: "asc" }
          });

          const nextMatch = nextMatches[nextMatchIndex];
          if (nextMatch) {
            const isEven = matchIndex % 2 === 0;
            await tx.match.update({
              where: { id: nextMatch.id },
              data: isEven ? { homeTeamId: winnerId } : { awayTeamId: winnerId }
            });

            const players = await tx.teamMembership.findMany({
              where: { teamId: winnerId, leftAt: null }
            });
            await tx.matchCallUp.createMany({
              data: players.map(p => ({ matchId: nextMatch.id, teamId: winnerId, playerId: p.playerId })),
              skipDuplicates: true
            });
          }
        }
      }

      // 6. Recálculo Atómico de Estadísticas (Sistema 10) — D-1 v2: batch secuencial.
      // Orden jugadores → equipos → standings NO es cosmético: el fair play del equipo
      // lee los PlayerStats recién escritos (read-your-own-writes en tx). Elimina la
      // carrera latente del Promise.all original, que mezclaba lectores y escritores
      // de PlayerStats en paralelo.
      const teamIds = [...new Set([match.homeTeamId, match.awayTeamId].filter(Boolean) as string[])];
      const playerIds = [...new Set(playerStats.map(ps => ps.playerId))];
      const isWalkover = false;

      if (!isWalkover) {
        await statsEngine.recalculatePlayerStatsBatch(tx, playerIds);
        await statsEngine.recalculateTeamStatsBatch(tx, teamIds);
        await statsEngine.recalculateTournamentStandings(tx, match.tournamentId);
      }

      // 7. Emitir Notificaciones (Sistema 11) — D-1 v2: loteadas vía método aditivo
      // del engine (mantiene la semántica de preferencias: sin fila = habilitado).
      const usersToNotify = await tx.player.findMany({
        where: { id: { in: playerIds } },
        select: { profile: { select: { userId: true } } }
      });

      await notificationEngine.createManyForMatch(
        tx,
        usersToNotify.map(u => ({
          userId: u.profile.userId,
          family: NotificationFamily.MATCH,
          type: NotificationType.MATCH_RESULT_LOADED,
          title: "Resultado Cargado",
          body: `El resultado de tu partido ha sido cargado. ${homeScore} - ${awayScore}`,
          payload: { matchId, tournamentId: match.tournamentId },
        })),
      );

      return { success: true };
      },
      // Cinturón: la cascada batch debería resolver en <10s incluso en dev WASM,
      // pero el timeout explícito se conserva como decisión ya tomada.
      { timeout: 30000, maxWait: 10000 },
    );
  }
};