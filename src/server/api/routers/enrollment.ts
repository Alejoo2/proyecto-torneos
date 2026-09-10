// src/server/api/routers/enrollment.ts
import { z } from "zod";
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

  // ─── Aprobar Pago (Gestor) ───
  approve: permissionProcedure("tournament:manage")
    .input(z.object({ enrollmentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Obtener managerId del usuario actual
      const manager = await ctx.db.manager.findFirst({
        where: { profile: { userId: ctx.session.user.id } },
      });
      if (!manager) throw new Error("Manager no encontrado");
      
      return enrollmentEngine.approve(ctx.db, input.enrollmentId, manager.id);
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