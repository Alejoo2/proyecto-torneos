import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
  permissionProcedure,
} from "torneos/server/api/trpc";
import { courtEngine } from "torneos/server/core/court/court.engine";
import {
  getMapData,
  getBubbleData,
  getPublicCourtById,
} from "torneos/server/core/court/hub.engine";

export const courtRouter = createTRPCRouter({
  // ─── Admin: Crear ───
  create: permissionProcedure("court:create")
    .input(z.object({
      name: z.string().min(2).max(100),
      address: z.string().min(5).max(300),
      description: z.string().max(1000).optional(),
      inventory: z.string().max(1000).optional(),
      lat: z.number().min(-90).max(90).optional(),
      lon: z.number().min(-180).max(180).optional(),
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
      lat: z.number().min(-90).max(90).optional(),
      lon: z.number().min(-180).max(180).optional(),
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
  // NO convertir a público: list es para admin (ALL/DISABLED).
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

      // ─── B-04: Grilla de disponibilidad pública (anónimos) ───
  // Decisión aplicada: pública si la cancha está ENABLED.
  // Espeja getAvailability (misma ventana de 14 días) para no divergir.
  getAvailabilityPublic: publicProcedure
    .input(z.object({ courtId: z.string() }))
    .query(async ({ ctx, input }) => {
      const court = await ctx.db.court.findUnique({
        where: { id: input.courtId },
        select: { status: true },
      });
      if (court?.status !== "ENABLED") {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cancha no disponible" });
      }

      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const inTwoWeeks = new Date(today);
      inTwoWeeks.setUTCDate(today.getUTCDate() + 14);

      return ctx.db.courtAvailability.findMany({
        where: { courtId: input.courtId, date: { gte: today, lt: inTwoWeeks } },
        orderBy: [{ date: "asc" }, { timeSlot: "asc" }],
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

  // ─── Vitrina anónima (publicProcedure, solo lecturas) ───

  // Pines del mapa: solo ENABLED (lo filtra el engine)
  getMap: publicProcedure.query(({ ctx }) => getMapData(ctx.db)),

  // Burbuja: matriz 7×12 + torneos de vitrina. DISABLED → NOT_FOUND
  // (antes devolvía null; el contrato ahora es error, más simple de manejar)
  getBubble: publicProcedure
    .input(z.object({ courtId: z.string() }))
    .query(async ({ ctx, input }) => {
      const bubble = await getBubbleData(ctx.db, input.courtId);
      if (!bubble) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cancha no encontrada" });
      }
      return bubble;
    }),

  // Detalle de vitrina de cancha ENABLED
  getPublicById: publicProcedure
    .input(z.object({ courtId: z.string() }))
    .query(({ ctx, input }) => getPublicCourtById(ctx.db, input.courtId)),
});