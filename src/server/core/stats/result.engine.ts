import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { statsEngine } from "./stats.engine";
import { notificationEngine } from "../notification/notification.engine";

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
          // Lógica simplificada para encontrar el partido hijo en el bracket.
          // Asumiendo que el partido actual es el índice N en su fase, 
          // alimentará al partido Math.floor(N/2) en la siguiente fase.
          const currentPhaseMatches = await tx.match.findMany({
            where: { phaseId: match.phaseId },
            orderBy: { createdAt: "asc" } // El orden de creación dicta el bracket
          });
          
          const matchIndex = currentPhaseMatches.findIndex(m => m.id === matchId);
          const nextMatchIndex = Math.floor(matchIndex / 2);
          
          const nextMatches = await tx.match.findMany({
            where: { phaseId: nextPhase.id },
            orderBy: { createdAt: "asc" }
          });
          
          const nextMatch = nextMatches[nextMatchIndex];
          if (nextMatch) {
            // Si es par, va al homeTeam, si es impar al awayTeam (convención típica de brackets)
            const isEven = matchIndex % 2 === 0;
            await tx.match.update({
              where: { id: nextMatch.id },
              data: isEven ? { homeTeamId: winnerId } : { awayTeamId: winnerId }
            });

            // Crear convocatorias para los jugadores del equipo que avanza
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

      // 6. Recálculo Atómico de Estadísticas (Sistema 10)
      const teamIds = [match.homeTeamId, match.awayTeamId].filter(Boolean) as string[];
      const playerIds = playerStats.map(ps => ps.playerId);
      const isWalkover = false;

      if (!isWalkover) {
        await Promise.all([
          ...playerIds.map(pid => statsEngine.recalculatePlayerStats(tx, pid)),
          ...teamIds.map(tid => statsEngine.recalculateTeamStats(tx, tid)),
          statsEngine.recalculateTournamentStandings(tx, match.tournamentId)
        ]);
      }

      // 7. Emitir Notificaciones (Sistema 11)
      const usersToNotify = await tx.player.findMany({
        where: { id: { in: playerIds } },
        select: { profile: { select: { userId: true } } }
      });

      await Promise.all(usersToNotify.map(u => 
        notificationEngine.create(tx, {
          userId: u.profile.userId,
          family: "MATCH",
          type: "MATCH_RESULT_LOADED",
          title: "Resultado Cargado",
          body: `El resultado de tu partido ha sido cargado. ${homeScore} - ${awayScore}`,
          payload: { matchId, tournamentId: match.tournamentId }
        })
      ));

      return { success: true };
    });
  }
};