import { TRPCError } from "@trpc/server";
import { Prisma, type PrismaClient } from "@prisma/client";

type PrismaDb = PrismaClient | Prisma.TransactionClient;

/**
 * S02 §8 — auto-ausencia del jugador para UN torneo (resuelve su rojo).
 * Potestad exclusiva del jugador. Factor 1 la excluye (Fase 3).
 * Distinta del markAbsent del capitán (convocatoria puntual, S07).
 */
export const absenceEngine = {
  async mark(db: PrismaClient, input: { tournamentId: string; teamId: string; reason?: string }, userId: string) {
    const player = await db.player.findFirst({
      where: { profile: { userId } },
      select: { id: true },
    });
    if (!player) throw new TRPCError({ code: "NOT_FOUND", message: "Jugador no encontrado" });
    const membership = await db.teamMembership.findFirst({
      where: { teamId: input.teamId, playerId: player.id, leftAt: null },
      select: { id: true },
    });
    if (!membership) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Solo miembros del equipo" });
    }
    const enrollment = await db.tournamentEnrollment.findUnique({
      where: { tournamentId_teamId: { tournamentId: input.tournamentId, teamId: input.teamId } },
      select: { id: true },
    });
    if (!enrollment) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Tu equipo no está inscrito en ese torneo" });
    }
    return db.tournamentAbsence.upsert({
      where: { playerId_tournamentId: { playerId: player.id, tournamentId: input.tournamentId } },
      update: { teamId: input.teamId, reason: input.reason ?? null },
      create: { playerId: player.id, tournamentId: input.tournamentId, teamId: input.teamId, reason: input.reason ?? null },
    });
  },

  async clear(db: PrismaClient, tournamentId: string, userId: string) {
    const player = await db.player.findFirst({
      where: { profile: { userId } },
      select: { id: true },
    });
    if (!player) throw new TRPCError({ code: "NOT_FOUND", message: "Jugador no encontrado" });
    await db.tournamentAbsence.deleteMany({
      where: { playerId: player.id, tournamentId },
    });
    return { ok: true };
  },

  async listMine(db: PrismaClient, userId: string) {
    const player = await db.player.findFirst({
      where: { profile: { userId } },
      select: { id: true },
    });
    if (!player) return [];
    return db.tournamentAbsence.findMany({
      where: { playerId: player.id },
      include: { tournament: { select: { id: true, name: true, status: true } } },
      orderBy: { createdAt: "desc" },
    });
  },

  /** Miembros del equipo con rojo en la franja (2+ torneos distintos).
   *  Fuente del badge de gestión y de la notificación "elige cancha". */
  async teamHardConflicts(
    db: PrismaDb,
    teamId: string,
    dayOfWeek: number,
    timeSlot: number,
  ) {
    const ACTIVE = ["PENDING_AVAILABILITY", "PENDING_PAYMENT", "APPROVED"] as const;
    const members = await db.teamMembership.findMany({
      where: { teamId, leftAt: null },
      select: {
        playerId: true,
        player: { select: { profile: { select: { userId: true, displayName: true } } } },
      },
    });
    const out: {
      playerId: string;
      userId: string;
      displayName: string | null;
      otherTournaments: { id: string; name: string }[];
    }[] = [];
    for (const m of members) {
      const teams = await db.teamMembership.findMany({
        where: { playerId: m.playerId, leftAt: null },
        select: { teamId: true },
      });
      const tids = teams.map((t) => t.teamId);
      if (tids.length === 0) continue;
      const enrollments = await db.tournamentEnrollment.findMany({
        where: {
          teamId: { in: tids },
          status: { in: [...ACTIVE] },
          tournament: {
            status: { in: ["SCHEDULED", "GRACE_PERIOD", "IN_PROGRESS"] },
            dayOfWeek,
            timeSlot,
          },
        },
        select: { tournament: { select: { id: true, name: true } } },
      });
      const seen = new Map(enrollments.map((e) => [e.tournament.id, e.tournament]));
      const matches = await db.match.findMany({
        where: {
          status: { in: ["SCHEDULED", "IN_PROGRESS"] },
          OR: [{ homeTeamId: { in: tids } }, { awayTeamId: { in: tids } }],
        },
        select: { tournamentId: true, date: true, timeSlot: true, tournament: { select: { id: true, name: true } } },
      });
      for (const mt of matches) {
        if (!mt.date || mt.timeSlot === null) continue;
        if (new Date(mt.date).getUTCDay() !== dayOfWeek || mt.timeSlot !== timeSlot) continue;
        if (!seen.has(mt.tournament.id)) seen.set(mt.tournament.id, mt.tournament);
      }
      if (seen.size >= 2) {
        out.push({
          playerId: m.playerId,
          userId: m.player.profile.userId,
          displayName: m.player.profile.displayName,
          otherTournaments: [...seen.values()],
        });
      }
    }
    return out;
  },
};
