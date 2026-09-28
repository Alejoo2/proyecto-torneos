import { TRPCError } from "@trpc/server";
import { Prisma, type PrismaClient } from "@prisma/client";
import { delegationEngine } from "torneos/server/core/delegation/delegation.engine";
import { notificationEngine } from "torneos/server/core/notification/notification.engine";

type PrismaDb = PrismaClient | Prisma.TransactionClient;

/**
 * E6 — invites de equipos a torneos PRIVATE. Al aceptar, el capitán crea una
 * TournamentEnrollment en estado default (PENDING_AVAILABILITY): entra al
 * flujo W3 intacto. Sin timers, sin expiración.
 */
export const inviteEngine = {
  /** Invites PENDING de los equipos que capitaneo (bandeja /invitaciones). */
  async listMyTeamInvites(db: PrismaDb, userId: string) {
    const memberships = await db.teamMembership.findMany({
      where: { isCaptain: true, leftAt: null, player: { profile: { userId } } },
      select: { teamId: true },
    });
    const teamIds = memberships.map((m) => m.teamId);
    if (teamIds.length === 0) return [];
    return db.tournamentTeamInvite.findMany({
      where: { teamId: { in: teamIds }, status: "PENDING" },
      include: {
        tournament: { select: { id: true, name: true, status: true, dayOfWeek: true, timeSlot: true } },
        team: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  /** Aceptar: invite ACCEPTED + enrollment default. Solo el capitán del equipo. */
  async acceptTeamInvite(db: PrismaClient, inviteId: string, userId: string) {
    const invite = await db.tournamentTeamInvite.findUnique({ where: { id: inviteId } });
    if (invite?.status !== "PENDING") {
      throw new TRPCError({ code: "NOT_FOUND", message: "Invitación no encontrada" });
    }
    const captaincy = await db.teamMembership.findFirst({
      where: { teamId: invite.teamId, isCaptain: true, leftAt: null, player: { profile: { userId } } },
      select: { id: true },
    });
    if (!captaincy) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Solo el capitán del equipo acepta" });
    }
    return db.$transaction(async (tx) => {
      await tx.tournamentTeamInvite.update({
        where: { id: inviteId },
        data: { status: "ACCEPTED", respondedAt: new Date() },
      });
      await tx.tournamentEnrollment.upsert({
        where: { tournamentId_teamId: { tournamentId: invite.tournamentId, teamId: invite.teamId } },
        update: {},
        create: { tournamentId: invite.tournamentId, teamId: invite.teamId, status: "PENDING_AVAILABILITY" },
      });
      return { ok: true };
    });
  },

  /** Rechazar: invite DECLINED. Solo el capitán del equipo. */
  async declineTeamInvite(db: PrismaDb, inviteId: string, userId: string) {
    const invite = await db.tournamentTeamInvite.findUnique({ where: { id: inviteId } });
    if (invite?.status !== "PENDING") {
      throw new TRPCError({ code: "NOT_FOUND", message: "Invitación no encontrada" });
    }
    const captaincy = await db.teamMembership.findFirst({
      where: { teamId: invite.teamId, isCaptain: true, leftAt: null, player: { profile: { userId } } },
      select: { id: true },
    });
    if (!captaincy) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Solo el capitán del equipo responde" });
    }
    return db.tournamentTeamInvite.update({
      where: { id: inviteId },
      data: { status: "DECLINED", respondedAt: new Date() },
    });
  },

  /** Invitar equipo a un PRIVATE (gestor o secretario con enrollment:manage).
   *  Crea PENDING + notifica a sus capitanes. Sin timers. */
  async inviteTeam(db: PrismaClient, input: { tournamentId: string; teamId: string }, userId: string) {
    const { tournament } = await delegationEngine.getTournamentForManagerAction(
      db, input.tournamentId, userId, "enrollment:manage",
    );
    if (tournament.type !== "PRIVATE") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Solo los torneos privados usan invitación" });
    }
    const team = await db.team.findUnique({ where: { id: input.teamId }, select: { id: true, name: true, status: true } });
    if (team?.status !== "ACTIVE") {
      throw new TRPCError({ code: "NOT_FOUND", message: "Equipo no disponible" });
    }
    const existing = await db.tournamentTeamInvite.findUnique({
      where: { tournamentId_teamId: { tournamentId: input.tournamentId, teamId: input.teamId } },
    });
    if (existing?.status === "PENDING") {
      throw new TRPCError({ code: "CONFLICT", message: "Ya hay invitación pendiente" });
    }
    if (existing?.status === "ACCEPTED") {
      throw new TRPCError({ code: "CONFLICT", message: "El equipo ya aceptó" });
    }
    const enrolled = await db.tournamentEnrollment.findUnique({
      where: { tournamentId_teamId: { tournamentId: input.tournamentId, teamId: input.teamId } },
    });
    if (enrolled) {
      throw new TRPCError({ code: "CONFLICT", message: "El equipo ya está inscrito" });
    }
    return db.$transaction(async (tx) => {
      const invite = await tx.tournamentTeamInvite.upsert({
        where: { tournamentId_teamId: { tournamentId: input.tournamentId, teamId: input.teamId } },
        update: { status: "PENDING", respondedAt: null },
        create: { tournamentId: input.tournamentId, teamId: input.teamId, invitedByUserId: userId, status: "PENDING" },
      });
      const captains = await tx.teamMembership.findMany({
        where: { teamId: input.teamId, isCaptain: true, leftAt: null },
        select: { player: { select: { profile: { select: { userId: true } } } } },
      });
      for (const c of captains) {
        await notificationEngine.create(tx, {
          userId: c.player.profile.userId,
          family: "TOURNAMENT",
          type: "TOURNAMENT_PUBLISHED",
          title: "Torneo privado: te invitaron",
          body: `${tournament.name} invita a ${team.name}. Revísala en Invitaciones.`,
          payload: { tournamentId: input.tournamentId, teamId: input.teamId },
        });
      }
      return invite;
    });
  },

  /** Invites de un torneo (gestor o secretario con enrollment:manage). */
  async listTournamentInvites(db: PrismaDb, tournamentId: string, userId: string) {
    await delegationEngine.getTournamentForManagerAction(db, tournamentId, userId, "enrollment:manage");
    return db.tournamentTeamInvite.findMany({
      where: { tournamentId },
      include: { team: { select: { id: true, name: true, abbreviation: true } } },
      orderBy: { createdAt: "desc" },
    });
  },

  /** Buscar equipos ACTIVE para invitar (excluye invitados/inscritos). */
  async searchTeams(db: PrismaDb, tournamentId: string, userId: string, query: string) {
    await delegationEngine.getTournamentForManagerAction(db, tournamentId, userId, "enrollment:manage");
    const q = query.trim();
    if (q.length < 2) return [];
    return db.team.findMany({
      where: {
        status: "ACTIVE",
        name: { contains: q, mode: "insensitive" },
        tournamentInvites: { none: { tournamentId } },
        enrollments: { none: { tournamentId } },
      },
      select: { id: true, name: true, abbreviation: true, primaryColor: true },
      take: 10,
      orderBy: { name: "asc" },
    });
  },

  /** Retirar invitación PENDING (gestor o secretario con enrollment:manage). */
  async revokeTeamInvite(db: PrismaDb, inviteId: string, userId: string) {
    const invite = await db.tournamentTeamInvite.findUnique({ where: { id: inviteId } });
    if (invite?.status !== "PENDING") {
      throw new TRPCError({ code: "NOT_FOUND", message: "Invitación no encontrada" });
    }
    await delegationEngine.getTournamentForManagerAction(db, invite.tournamentId, userId, "enrollment:manage");
    return db.tournamentTeamInvite.delete({ where: { id: inviteId } });
  },
};
