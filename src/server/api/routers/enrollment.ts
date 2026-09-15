import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, permissionProcedure } from "torneos/server/api/trpc";
import { enrollmentEngine } from "torneos/server/core/tournament/enrollment.engine";

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

  // ─── Aprobar Pago (Gestor) ───
  approve: permissionProcedure("tournament:manage")
    .input(z.object({ enrollmentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const manager = await ctx.db.manager.findFirst({
        where: { profile: { userId: ctx.session.user.id } },
      });
      if (!manager) throw new Error("Manager no encontrado");

      return enrollmentEngine.approve(ctx.db, input.enrollmentId, manager.id);
    }),

  // ─── B-12: Rechazar inscripción (Gestor) ───
  // Engine ya existe, solo se expone. REJECTED ≠ DISAPPROVED en el enum.
  reject: permissionProcedure("tournament:manage")
    .input(z.object({
      enrollmentId: z.string(),
      reason: z.string().min(10, "El motivo debe tener al menos 10 caracteres"),
    }))
    .mutation(async ({ ctx, input }) => {
      const manager = await ctx.db.manager.findFirst({
        where: { profile: { userId: ctx.session.user.id } },
      });
      if (!manager) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Manager no encontrado" });
      }

      return enrollmentEngine.reject(ctx.db, input.enrollmentId, manager.id, input.reason);
    }),

  // ─── B-11: Reevaluar disponibilidad (Capitán) ───
  // Engine ya existe, solo se expone. El engine valida capitanía con el userId.
  reevaluate: protectedProcedure
    .input(z.object({ enrollmentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return enrollmentEngine.reevaluate(ctx.db, input.enrollmentId, ctx.session.user.id);
    }),

  // ─── Listar Inscripciones del Torneo (Gestor) ───
  listByTournament: permissionProcedure("tournament:manage")
    .input(z.object({
      tournamentId: z.string(),
      status: z.enum(["PENDING_AVAILABILITY", "PENDING_PAYMENT", "APPROVED", "REJECTED", "DISAPPROVED", "ALL"]).default("ALL"),
    }))
    .query(async ({ ctx, input }) => {
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

  // ─── Desaprobar Inscripción (Gestor) ───
  disapprove: permissionProcedure("tournament:manage")
    .input(z.object({ enrollmentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const manager = await ctx.db.manager.findFirst({
        where: { profile: { userId: ctx.session.user.id } },
      });
      if (!manager) throw new TRPCError({ code: "FORBIDDEN", message: "Manager no encontrado" });

      return enrollmentEngine.disapprove(ctx.db, input.enrollmentId, manager.id);
    }),
});