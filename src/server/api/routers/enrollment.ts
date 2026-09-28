import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "torneos/server/api/trpc";
import { enrollmentEngine } from "torneos/server/core/tournament/enrollment.engine";
import { delegationEngine } from "torneos/server/core/delegation/delegation.engine";
import { inviteEngine } from "torneos/server/core/tournament/invite.engine";
import { absenceEngine } from "torneos/server/core/tournament/absence.engine";

export const enrollmentRouter = createTRPCRouter({
  // ─── Inscribir Equipo (Capitán) ───
  enroll: protectedProcedure
    .input(z.object({
      tournamentId: z.string(),
      teamId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      return enrollmentEngine.enroll(ctx.db, input, ctx.session.user.id);
    }),

  // ─── B-02: Estado de inscripción del usuario actual en un torneo ───
  // Devuelve ARRAY (no null): el usuario puede tener varios equipos inscriptos.
  // [] = sin inscripción de ninguno de sus equipos.
  getMyStatus: protectedProcedure
    .input(z.object({ tournamentId: z.string() }))
    .query(async ({ ctx, input }) => {
      const profile = await ctx.db.profile.findUnique({
        where: { userId: ctx.session.user.id },
        include: {
          player: {
            include: {
              teamMemberships: {
                where: { leftAt: null },
                select: { teamId: true },
              },
            },
          },
        },
      });

      const teamIds = profile?.player?.teamMemberships.map((m) => m.teamId) ?? [];
      if (teamIds.length === 0) return [];

      return ctx.db.tournamentEnrollment.findMany({
        where: {
          tournamentId: input.tournamentId,
          teamId: { in: teamIds },
        },
        include: {
          team: {
            select: { id: true, name: true, abbreviation: true, primaryColor: true },
          },
        },
        orderBy: { enrolledAt: "desc" },
      });
    }),

  // ─── Aprobar Pago (Gestor o secretario con enrollment:manage) ───
  approve: protectedProcedure
    .input(z.object({ enrollmentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const enrollment = await ctx.db.tournamentEnrollment.findUnique({
        where: { id: input.enrollmentId },
        select: { tournamentId: true },
      });
      if (!enrollment) throw new TRPCError({ code: "NOT_FOUND", message: "Inscripción no encontrada" });
      const { managerId } = await delegationEngine.getTournamentForManagerAction(
        ctx.db, enrollment.tournamentId, ctx.session.user.id, "enrollment:manage",
      );

      return enrollmentEngine.approve(ctx.db, input.enrollmentId, managerId);
    }),

  // ─── B-12: Rechazar inscripción (Gestor) ───
  // Engine ya existe, solo se expone. REJECTED ≠ DISAPPROVED en el enum.
  reject: protectedProcedure
    .input(z.object({
      enrollmentId: z.string(),
      reason: z.string().min(10, "El motivo debe tener al menos 10 caracteres"),
    }))
    .mutation(async ({ ctx, input }) => {
      const enrollment = await ctx.db.tournamentEnrollment.findUnique({
        where: { id: input.enrollmentId },
        select: { tournamentId: true },
      });
      if (!enrollment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Inscripción no encontrada" });
      }
      const { managerId } = await delegationEngine.getTournamentForManagerAction(
        ctx.db, enrollment.tournamentId, ctx.session.user.id, "enrollment:manage",
      );

      return enrollmentEngine.reject(ctx.db, input.enrollmentId, managerId, input.reason);
    }),

  // ─── B-11: Reevaluar disponibilidad (Capitán) ───
  // Engine ya existe, solo se expone. El engine valida capitanía con el userId.
  reevaluate: protectedProcedure
    .input(z.object({ enrollmentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return enrollmentEngine.reevaluate(ctx.db, input.enrollmentId, ctx.session.user.id);
    }),

  // ─── Listar Inscripciones del Torneo (Gestor o secretario con enrollment:manage) ───
  listByTournament: protectedProcedure
    .input(z.object({
      tournamentId: z.string(),
      status: z.enum(["PENDING_AVAILABILITY", "PENDING_PAYMENT", "APPROVED", "REJECTED", "DISAPPROVED", "ALL"]).default("ALL"),
    }))
    .query(async ({ ctx, input }) => {
      await delegationEngine.getTournamentForManagerAction(
        ctx.db, input.tournamentId, ctx.session.user.id, "enrollment:manage",
      );
      const status = input.status === "ALL" ? undefined : input.status;
      return ctx.db.tournamentEnrollment.findMany({
        where: {
          tournamentId: input.tournamentId,
          status: status,
        },
        include: {
          team: {
            select: { id: true, name: true, abbreviation: true, primaryColor: true }
          }
        },
        orderBy: { enrolledAt: "asc" },
      });
    }),

  // ─── Desaprobar Inscripción (Gestor o secretario con enrollment:manage) ───
  disapprove: protectedProcedure
    .input(z.object({ enrollmentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const enrollment = await ctx.db.tournamentEnrollment.findUnique({
        where: { id: input.enrollmentId },
        select: { tournamentId: true },
      });
      if (!enrollment) throw new TRPCError({ code: "NOT_FOUND", message: "Inscripción no encontrada" });
      const { managerId } = await delegationEngine.getTournamentForManagerAction(
        ctx.db, enrollment.tournamentId, ctx.session.user.id, "enrollment:manage",
      );

      return enrollmentEngine.disapprove(ctx.db, input.enrollmentId, managerId);
    }),

  // ─── Invites a torneos PRIVATE (E6: capitán del equipo) ───
  listMyTeamInvites: protectedProcedure.query(({ ctx }) => {
    return inviteEngine.listMyTeamInvites(ctx.db, ctx.session.user.id);
  }),

  acceptTeamInvite: protectedProcedure
    .input(z.object({ inviteId: z.string() }))
    .mutation(({ ctx, input }) => {
      return inviteEngine.acceptTeamInvite(ctx.db, input.inviteId, ctx.session.user.id);
    }),

  declineTeamInvite: protectedProcedure
    .input(z.object({ inviteId: z.string() }))
    .mutation(({ ctx, input }) => {
      return inviteEngine.declineTeamInvite(ctx.db, input.inviteId, ctx.session.user.id);
    }),

  // ─── Invitar equipos a PRIVATE (gestor o secretario con enrollment:manage) ───
  searchTeamsForInvite: protectedProcedure
    .input(z.object({ tournamentId: z.string(), query: z.string().trim().min(2).max(60) }))
    .query(({ ctx, input }) => {
      return inviteEngine.searchTeams(ctx.db, input.tournamentId, ctx.session.user.id, input.query);
    }),

  inviteTeam: protectedProcedure
    .input(z.object({ tournamentId: z.string(), teamId: z.string() }))
    .mutation(({ ctx, input }) => {
      return inviteEngine.inviteTeam(ctx.db, input, ctx.session.user.id);
    }),

  listTournamentInvites: protectedProcedure
    .input(z.object({ tournamentId: z.string() }))
    .query(({ ctx, input }) => {
      return inviteEngine.listTournamentInvites(ctx.db, input.tournamentId, ctx.session.user.id);
    }),

  revokeTeamInvite: protectedProcedure
    .input(z.object({ inviteId: z.string() }))
    .mutation(({ ctx, input }) => {
      return inviteEngine.revokeTeamInvite(ctx.db, input.inviteId, ctx.session.user.id);
    }),

  // ─── S02 §8: auto-ausencia del jugador por torneo (resuelve su rojo) ───
  markTournamentAbsence: protectedProcedure
    .input(z.object({
      tournamentId: z.string(),
      teamId: z.string(),
      reason: z.string().max(200).optional(),
    }))
    .mutation(({ ctx, input }) => {
      return absenceEngine.mark(ctx.db, input, ctx.session.user.id);
    }),

  clearTournamentAbsence: protectedProcedure
    .input(z.object({ tournamentId: z.string() }))
    .mutation(({ ctx, input }) => {
      return absenceEngine.clear(ctx.db, input.tournamentId, ctx.session.user.id);
    }),

  listMyTournamentAbsences: protectedProcedure.query(({ ctx }) => {
    return absenceEngine.listMine(ctx.db, ctx.session.user.id);
  }),
});