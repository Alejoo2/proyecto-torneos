import type { Prisma, PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { notificationEngine } from "../notification/notification.engine";
import { generateMatchesForElimination } from "./match.helpers";

type PrismaTx = Prisma.TransactionClient;

// ─────────────────────────────────────────────────────────────
// Helpers privados
// ─────────────────────────────────────────────────────────────

/**
 * Trae el partido validando que `userId` sea el gestor del torneo.
 * Sin esto, CUALQUIER manager podía modificar partidos de torneos ajenos.
 */
export async function getMatchForManagerAction(tx: PrismaTx, matchId: string, userId: string) {
  const match = await tx.match.findUnique({
    where: { id: matchId },
    include: {
      tournament: { include: { manager: { include: { profile: { select: { userId: true } } } } } },
    },
  });
  if (!match) throw new TRPCError({ code: "NOT_FOUND", message: "Partido no encontrado" });
  if (match.tournament.manager.profile.userId !== userId) {
    // W11 — E3 (visto del dueño): delegación "secretario de gestor", fail-closed.
    // Busca por RELACIÓN profile.userId (no depende del shape de la sesión).
    const delegation = await tx.managerDelegate.findFirst({
      where: { managerId: match.tournament.managerId, profile: { userId } },
      select: { id: true },
    });
    if (!delegation) {
      throw new TRPCError({ code: "FORBIDDEN", message: "No eres el gestor de este torneo" });
    }
  }
  return match;
}

/**
 * B-05: sincroniza la convocatoria con la plantilla VIGENTE.
 * A diferencia del deleteMany+create del reporte, PRESERVA las marcas
 * isAbsent de los jugadores que siguen en el equipo.
 */
async function syncCallUpsWithRoster(tx: PrismaTx, matchId: string) {
  const match = await tx.match.findUnique({
    where: { id: matchId },
    select: { homeTeamId: true, awayTeamId: true },
  });
  if (!match) return;

  const teamIds = [match.homeTeamId, match.awayTeamId].filter(Boolean) as string[];
  if (teamIds.length === 0) return;

  const [roster, existing] = await Promise.all([
    tx.teamMembership.findMany({
      where: { teamId: { in: teamIds }, leftAt: null },
      select: { playerId: true, teamId: true },
    }),
    tx.matchCallUp.findMany({ where: { matchId }, select: { id: true, playerId: true } }),
  ]);

  const rosterIds = new Set(roster.map((r) => r.playerId));

  // Quitar convocados que ya no están en ninguna plantilla
  const staleIds = existing.filter((c) => !rosterIds.has(c.playerId)).map((c) => c.id);
  if (staleIds.length > 0) {
    await tx.matchCallUp.deleteMany({ where: { id: { in: staleIds } } });
  }

  // Agregar jugadores nuevos (los existentes conservan isAbsent/markedBy/markedAt)
  const existingIds = new Set(existing.map((c) => c.playerId));
  const toCreate = roster
    .filter((r) => !existingIds.has(r.playerId))
    .map((r) => ({ matchId, teamId: r.teamId, playerId: r.playerId }));
  if (toCreate.length > 0) {
    await tx.matchCallUp.createMany({ data: toCreate, skipDuplicates: true });
  }
}

/** Notifica a todos los convocados de un partido */
async function notifyCallUpPlayers(
  tx: PrismaTx,
  matchId: string,
  notification: {
    type: "MATCH_POSTPONED" | "MATCH_RESCHEDULED";
    title: string;
    body: string;
    payload: { matchId: string; tournamentId: string };
  },
) {
  const callUps = await tx.matchCallUp.findMany({
    where: { matchId },
    select: { player: { select: { profile: { select: { userId: true } } } } },
  });

  for (const c of callUps) {
    await notificationEngine.create(tx, {
      userId: c.player.profile.userId,
      family: "MATCH",
      ...notification,
    });
  }
}

/**
 * Avance de ganador en eliminatoria (lógica por índice, la correcta de resultEngine).
 * Extraída para que markWalkover y loadResult usen la MISMA implementación.
 */
async function advanceWinnerInBracket(tx: PrismaTx, matchId: string, winnerTeamId: string) {
  const match = await tx.match.findUnique({ where: { id: matchId }, include: { phase: true } });
  if (!match) return;

  const nextPhase = await tx.tournamentPhase.findFirst({
    where: { tournamentId: match.tournamentId, order: match.phase.order + 1 },
  });
  if (!nextPhase) return;

  const [currentPhaseMatches, nextMatches] = await Promise.all([
    tx.match.findMany({ where: { phaseId: match.phaseId }, orderBy: { createdAt: "asc" }, select: { id: true } }),
    tx.match.findMany({ where: { phaseId: nextPhase.id }, orderBy: { createdAt: "asc" }, select: { id: true } }),
  ]);

  const matchIndex = currentPhaseMatches.findIndex((m) => m.id === matchId);
  if (matchIndex < 0) return;

  const nextMatch = nextMatches[Math.floor(matchIndex / 2)];
  if (!nextMatch) return;

  const isEven = matchIndex % 2 === 0;
  await tx.match.update({
    where: { id: nextMatch.id },
    data: isEven ? { homeTeamId: winnerTeamId } : { awayTeamId: winnerTeamId },
  });

  const players = await tx.teamMembership.findMany({ where: { teamId: winnerTeamId, leftAt: null } });
  await tx.matchCallUp.createMany({
    data: players.map((p) => ({ matchId: nextMatch.id, teamId: winnerTeamId, playerId: p.playerId })),
    skipDuplicates: true,
  });
}

// ─────────────────────────────────────────────────────────────
// Engine
// ─────────────────────────────────────────────────────────────

export const matchEngine = {
  /**
   * Genera la malla de partidos tras el closeAndDraw del Sistema 6.
   * Debe ejecutarse DENTRO de la transacción de closeAndDraw.
   */
    async generateFromDraw(
    tx: Prisma.TransactionClient,
    tournamentId: string,
    shuffledTeams: { id: string }[],
    dayOfWeek: number,
    timeSlot: number
  ) {
    const drawSlots = generateMatchesForElimination(shuffledTeams);
    const phases = await tx.tournamentPhase.findMany({
      where: { tournamentId },
      orderBy: { order: "asc" }
    });

    if (phases.length !== Math.log2(shuffledTeams.length)) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Inconsistencia entre fases creadas y equipos sorteados" });
    }

    const court = await tx.tournament.findUnique({
      where: { id: tournamentId },
      select: { courtId: true }
    });

    if (!court) throw new TRPCError({ code: "NOT_FOUND", message: "Torneo no encontrado" });

    const today = new Date();
    const todayDay = today.getDay();
    const diff = (dayOfWeek - todayDay + 7) % 7; // ← const (era let, nunca se reasigna)
    const firstMatchDate = new Date(today);
    firstMatchDate.setDate(today.getDate() + diff);
    firstMatchDate.setUTCHours(0, 0, 0, 0);

    for (const slot of drawSlots) {
      const phase = phases.find(p => p.order === slot.phaseOrder);
      if (!phase) continue;

      const matchDate = new Date(firstMatchDate);
      matchDate.setDate(matchDate.getDate() + ((slot.phaseOrder - 1) * 7));

      const newMatch = await tx.match.create({
        data: {
          tournamentId,
          phaseId: phase.id,
          homeTeamId: slot.homeTeamId ?? null,  // ← ?? en vez de || (lint)
          awayTeamId: slot.awayTeamId ?? null,  // ← idem
          courtId: court.courtId,
          date: matchDate,
          timeSlot: timeSlot,
          scheduledAt: matchDate,
          status: "SCHEDULED",
        }
      });

      // Convocatorias + notificaciones solo para fase 1
      if (slot.phaseOrder === 1 && slot.homeTeamId && slot.awayTeamId) {
        const homePlayers = await tx.teamMembership.findMany({
          where: { teamId: slot.homeTeamId, leftAt: null }
        });
        const awayPlayers = await tx.teamMembership.findMany({
          where: { teamId: slot.awayTeamId, leftAt: null }
        });

        const callUpsData = [...homePlayers, ...awayPlayers].map(m => ({
          matchId: newMatch.id,
          teamId: m.teamId,
          playerId: m.playerId,
        }));

        if (callUpsData.length > 0) {
          await tx.matchCallUp.createMany({ data: callUpsData, skipDuplicates: true });
        }

        const notificationData = {
          family: "MATCH" as const,
          type: "MATCH_SCHEDULED" as const,
          title: "Nuevo Partido Programado",
          body: `Tienes un partido programado para el ${matchDate.toLocaleDateString()}`,
          payload: { matchId: newMatch.id, tournamentId }
        };

        const userIds = await tx.player.findMany({
          where: { id: { in: [...homePlayers, ...awayPlayers].map(p => p.playerId) } },
          select: { profile: { select: { userId: true } } }
        });

        for (const u of userIds) {
          await notificationEngine.create(tx, {
            ...notificationData,
            userId: u.profile.userId,
          });
        }
      }
    }
  },

  async postpone(db: PrismaClient, matchId: string, reason: string, userId: string) {
    return db.$transaction(async (tx) => {
      // 🔒 Hallazgo 1: ahora valida ownership
      const match = await getMatchForManagerAction(tx, matchId, userId);
      if (match.status !== "SCHEDULED" && match.status !== "IN_PROGRESS") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "El partido no puede ser aplazado en su estado actual" });
      }

      // Liberar la franja horaria en CourtAvailability
      if (match.courtId && match.date && match.timeSlot) {
        await tx.courtAvailability.updateMany({
          where: { courtId: match.courtId, date: match.date, timeSlot: match.timeSlot },
          data: { status: "AVAILABLE" }
        });
      }

      const updated = await tx.match.update({
        where: { id: matchId },
        data: {
          status: "POSTPONED",
          postponedReason: reason,
          postponedAt: new Date(),
          postponedBy: userId
        },
      });

      // OPCIONAL (hallazgo 5): el enum MATCH_POSTPONED existía pero nadie lo emitía
      await notifyCallUpPlayers(tx, matchId, {
        type: "MATCH_POSTPONED",
        title: "Partido Aplazado",
        body: `Tu partido fue aplazado. Motivo: ${reason}`,
        payload: { matchId, tournamentId: match.tournamentId },
      });

      return updated;
    });
  },

  async reschedule(db: PrismaClient, matchId: string, newDate: Date, newTimeSlot: number, userId: string) {
    return db.$transaction(async (tx) => {
      // 🔒 Hallazgo 1: ownership
      const match = await getMatchForManagerAction(tx, matchId, userId);
      if (match.status !== "POSTPONED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Solo se pueden reprogramar partidos aplazados" });
      }
      if (!match.courtId) {
        // 🛡️ Hallazgo 6: antes era match.courtId! y crasheaba
        throw new TRPCError({ code: "BAD_REQUEST", message: "El partido no tiene cancha asignada" });
      }

      // 🛡️ Hallazgo 6: normalizar a medianoche UTC (columna @db.Date;
      // un date-picker con medianoche local UTC-3 puede caer el día anterior)
      const normalizedDate = new Date(newDate);
      normalizedDate.setUTCHours(0, 0, 0, 0);

      const availability = await tx.courtAvailability.findUnique({
        where: {
          courtId_date_timeSlot: {
            courtId: match.courtId,
            date: normalizedDate,
            timeSlot: newTimeSlot
          }
        }
      });

      if (availability?.status !== "AVAILABLE") {
        throw new TRPCError({ code: "CONFLICT", message: "La nueva franja horaria no está disponible" });
      }

      await tx.courtAvailability.update({
        where: { id: availability.id },
        data: { status: "UNAVAILABLE" }
      });

      const updated = await tx.match.update({
        where: { id: matchId },
        data: {
          status: "SCHEDULED",
          date: normalizedDate,
          timeSlot: newTimeSlot,
          scheduledAt: normalizedDate,
        },
      });

      // ✅ B-05: sincronizar convocatoria con plantilla vigente
      // (conserva isAbsent de quienes siguen, agrega nuevos, quita salidos)
      await syncCallUpsWithRoster(tx, matchId);

      // OPCIONAL (hallazgo 5): después del sync, para que también lo reciban los nuevos
      await notifyCallUpPlayers(tx, matchId, {
        type: "MATCH_RESCHEDULED",
        title: "Partido Reprogramado",
        body: `Tu partido fue reprogramado para el ${normalizedDate.toLocaleDateString("es-AR")} (franja ${newTimeSlot}).`,
        payload: { matchId, tournamentId: match.tournamentId },
      });

      return updated;
    });
  },

  async markWalkover(db: PrismaClient, matchId: string, winnerTeamId: string, userId: string) {
    return db.$transaction(async (tx) => {
      // 🔒 Hallazgo 1: ownership
      const match = await getMatchForManagerAction(tx, matchId, userId);
      if (match.status === "FINISHED" || match.status === "WALKOVER") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "El partido ya finalizó" });
      }

      // 🔒 Hallazgo 2: el ganador debe participar del partido
      if (winnerTeamId !== match.homeTeamId && winnerTeamId !== match.awayTeamId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "El equipo ganador no participa en este partido" });
      }

      await tx.matchResult.create({
        data: {
          matchId,
          homeScore: 0,
          awayScore: 0,
          winnerId: winnerTeamId,
          isWalkover: true,
          loadedBy: userId,
        }
      });

      // 🛡️ Hallazgo 3: misma lógica por-índice que resultEngine
      // (antes: findFirst sin orden → podía asignar al partido equivocado)
      await advanceWinnerInBracket(tx, matchId, winnerTeamId);

      return tx.match.update({
        where: { id: matchId },
        data: { status: "WALKOVER", walkoverTeamId: winnerTeamId }
      });
    });
  }
};