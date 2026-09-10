import { z } from "zod";
import { createTRPCRouter, protectedProcedure, permissionProcedure } from "torneos/server/api/trpc";
import { courtEngine } from "torneos/server/core/court/court.engine";
import { getMapData, getBubbleData } from "torneos/server/core/court/hub.engine";

export const courtRouter = createTRPCRouter({
  // ─── Admin: Crear ───
  create: permissionProcedure("court:create")
    .input(z.object({
      name: z.string().min(2).max(100),
      address: z.string().min(5).max(300),
      description: z.string().max(1000).optional(),
      inventory: z.string().max(1000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return courtEngine.create(ctx.db, input);
    }),

  // ─── Admin: Actualizar ───
  update: permissionProcedure("court:edit")
    .input(z.object({
      courtId: z.string(),
      name: z.string().min(2).max(100).optional(),
      address: z.string().min(5).max(300).optional(),
      description: z.string().max(1000).optional().nullable(),
      inventory: z.string().max(1000).optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      return courtEngine.update(ctx.db, input);
    }),

  // ─── Admin: Deshabilitar Total ───
  disable: permissionProcedure("court:disable")
    .input(z.object({ courtId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return courtEngine.disable(ctx.db, input.courtId);
    }),

  // ─── Admin: Habilitar Total ───
  enable: permissionProcedure("court:disable")
    .input(z.object({ courtId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return courtEngine.enable(ctx.db, input.courtId);
    }),

  // ─── Admin: Toggle Franja Individual ───
  toggleAvailability: permissionProcedure("court:edit")
    .input(z.object({
      courtId: z.string(),
      date: z.date(),
      timeSlot: z.number().min(0).max(11),
    }))
    .mutation(async ({ ctx, input }) => {
      return courtEngine.toggleAvailability(ctx.db, input);
    }),

  // ─── Consultas Públicas (Autenticadas) ───
  list: protectedProcedure
    .input(z.object({
      status: z.enum(["ENABLED", "DISABLED", "ALL"]).default("ALL"),
    }).optional())
    .query(async ({ ctx, input }) => {
      const status = input?.status === "ALL" ? undefined : input?.status;
      return ctx.db.court.findMany({
        where: { status },
        orderBy: { name: "asc" },
      });
    }),

  getById: protectedProcedure
    .input(z.object({ courtId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.court.findUnique({
        where: { id: input.courtId },
      });
    }),

  getAvailability: protectedProcedure
    .input(z.object({ courtId: z.string() }))
    .query(async ({ ctx, input }) => {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      
      const inTwoWeeks = new Date(today);
      inTwoWeeks.setUTCDate(today.getUTCDate() + 14);

      return ctx.db.courtAvailability.findMany({
        where: {
          courtId: input.courtId,
          date: {
            gte: today,
            lt: inTwoWeeks,
          },
        },
        orderBy: { date: "asc" },
      });
    }),
      // ─── Admin: Cerrar Día (Bulk) ───
  setAvailability: permissionProcedure("court:edit")
    .input(z.object({
      courtId: z.string(),
      slots: z.array(z.object({
        date: z.date(),
        timeSlot: z.number().min(0).max(11),
        status: z.enum(["AVAILABLE", "UNAVAILABLE"]),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      return courtEngine.setAvailability(ctx.db, input);
    }),

    // ─── Hub: Pines del mapa (read-model ligero) ───
  getMap: protectedProcedure.query(({ ctx }) => getMapData(ctx.db)),

  // ─── Hub: Burbuja de detalle (matriz 7×12 + torneos activos) ───
  getBubble: protectedProcedure
    .input(z.object({ courtId: z.string() }))
    .query(({ ctx, input }) => getBubbleData(ctx.db, input.courtId)
  ),
});