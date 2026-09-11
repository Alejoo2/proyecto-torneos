import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
  permissionProcedure,
} from "torneos/server/api/trpc";
import { tournamentEngine } from "torneos/server/core/tournament/tournament.engine";
import { slotHoldEngine } from "torneos/server/core/tournament/slotHold.engine";

export const tournamentRouter = createTRPCRouter({
  // ─── Vitrina anónima (publicProcedure, solo lecturas) ───
  // Read-model distinto al del gestor (vitrineCard/DetailSelect): sin manager,
  // sin PENDING_*, sin holds. NOT_FOUND si no califica como vitrina.

  /** Lista /torneos anónima. */
  listPublic: publicProcedure.query(({ ctx }) =>
    tournamentEngine.listPublic(ctx.db),
  ),

  /** Detalle /torneos/:id anónimo. PRIVATE/DRAFT/CANCELLED → NOT_FOUND. */
  getPublicById: publicProcedure
    .input(z.object({ tournamentId: z.string() }))
    .query(({ ctx, input }) =>
      tournamentEngine.getPublicById(ctx.db, input.tournamentId),
    ),

  /** Torneos de vitrina de una cancha (detalle /canchas/:id anónimo). */
  listByCourtPublic: publicProcedure
    .input(z.object({ courtId: z.string() }))
    .query(({ ctx, input }) =>
      tournamentEngine.listByCourtPublic(ctx.db, input.courtId),
    ),

  // ─── Crear (Gestor) ───
  create: permissionProcedure("tournament:create")
    .input(z.object({
      name: z.string().min(2).max(100),
      description: z.string().max(2000).optional(),
      courtId: z.string(),
      maxTeams: z.number().refine(n => Number.isInteger(Math.log2(n)) && n >= 2, {
        message: "maxTeams debe ser potencia de 2 (mínimo 2)"
      }),
      type: z.enum(["PUBLIC", "PRIVATE"]).default("PUBLIC"),
      format: z.enum(["SINGLE_ELIMINATION", "LEAGUE", "LEAGUE_PLUS_ELIMINATION"]).default("SINGLE_ELIMINATION"),
      enrollmentDeadline: z.coerce.date().refine(d => d > new Date(), {
        message: "La fecha límite debe ser futura"
      }),
      dayOfWeek: z.number().min(0).max(6),
      timeSlot: z.number().min(0).max(11),
      startDate: z.coerce.date().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return tournamentEngine.create(ctx.db, input, ctx.session.user.id);
    }),

  // ─── Publicar (Gestor) ───
  publish: permissionProcedure("tournament:manage")
    .input(z.object({ tournamentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return tournamentEngine.publish(ctx.db, input.tournamentId, ctx.session.user.id);
    }),

  // ─── Cerrar y Sortear (Gestor) ───
  closeAndDraw: permissionProcedure("tournament:manage")
    .input(z.object({ tournamentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return tournamentEngine.closeAndDraw(ctx.db, input.tournamentId, ctx.session.user.id);
    }),

  // ─── Consultas (autenticadas: gestor ve DRAFT/PRIVATE + PENDING_*) ───
  getById: protectedProcedure
    .input(z.object({ tournamentId: z.string() }))
    .query(async ({ ctx, input }) => {
      return tournamentEngine.getById(ctx.db, input.tournamentId);
    }),

  // ─── Sala de Cine (Capitán) ───
  holdSlot: protectedProcedure
    .input(z.object({ tournamentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return slotHoldEngine.hold(ctx.db, input.tournamentId, ctx.session.user.id);
    }),

  checkHold: protectedProcedure
    .input(z.object({ tournamentId: z.string() }))
    .query(async ({ ctx, input }) => {
      return slotHoldEngine.check(ctx.db, input.tournamentId, ctx.session.user.id);
    }),

  // ─── Listar por Cancha (autenticado; gestor ve DRAFT) ───
  listByCourt: protectedProcedure
    .input(z.object({ courtId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verificamos si el usuario actual es gestor activo
      const manager = await ctx.db.manager.findFirst({
        where: {
          profile: { userId: ctx.session.user.id },
          isActive: true
        },
      });

      // Si es gestor, puede ver los DRAFT. Si no, solo los públicos (SCHEDULED etc)
      const allowedStatuses = manager
        ? ["DRAFT", "SCHEDULED", "IN_PROGRESS", "GRACE_PERIOD"]
        : ["SCHEDULED", "IN_PROGRESS", "GRACE_PERIOD"];

      return ctx.db.tournament.findMany({
        where: {
          courtId: input.courtId,
          status: { in: allowedStatuses }
        },
        include: {
          _count: {
            select: { enrollments: { where: { status: "APPROVED" } } }
          }
        },
        orderBy: { enrollmentDeadline: "asc" },
      });
    }),

  // ─── Cancelar Torneo (Gestor) ───
  cancel: permissionProcedure("tournament:manage")
    .input(z.object({ tournamentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return tournamentEngine.cancel(ctx.db, input.tournamentId, ctx.session.user.id);
    }),
});