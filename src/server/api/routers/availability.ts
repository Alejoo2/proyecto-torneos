import { createTRPCRouter, protectedProcedure } from "torneos/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { availabilityEngine } from "torneos/server/core/availability/availability.engine";
import { z } from "zod";

export const availabilityRouter = createTRPCRouter({
  getMine: protectedProcedure.query(async ({ ctx }) => { // <-- Añadido async
    return await ctx.db.profile.findUnique({ // <-- Añadido await
      where: { userId: ctx.session.user.id },
      include: { player: { include: { availabilities: true } } },
    });
  }),

  toggleSlot: protectedProcedure
    .input(
      z.object({
        dayOfWeek: z.number().min(0).max(6),
        timeSlot: z.number().min(0).max(11),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const profile = await ctx.db.profile.findUnique({
        where: { userId: ctx.session.user.id },
        include: { player: true },
      });

      if (!profile?.player) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Jugador no encontrado para este usuario" });
      }
      const playerId = profile.player.id;

      return availabilityEngine.toggleSlot(
        ctx.db,
        playerId,
        input.dayOfWeek,
        input.timeSlot
      );
    }),

  // ─── S02 §6: guardado por lotes (timer ~1 min en cliente, UNA mutación) ───
  setSlots: protectedProcedure
    .input(
      z.object({
        slots: z
          .array(
            z.object({
              dayOfWeek: z.number().min(0).max(6),
              timeSlot: z.number().min(0).max(11),
              status: z.enum(["AVAILABLE", "UNAVAILABLE"]),
            })
          )
          .min(1)
          .max(84),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const profile = await ctx.db.profile.findUnique({
        where: { userId: ctx.session.user.id },
        include: { player: true },
      });

      if (!profile?.player) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Jugador no encontrado para este usuario" });
      }

      return availabilityEngine.setSlots(ctx.db, profile.player.id, input.slots);
    }),

  // ─── S02 v2.0: matriz fusionada (verde/gris + amarillo + rojo) ───
  getMatrix: protectedProcedure.query(async ({ ctx }) => {
    return availabilityEngine.getMatrix(ctx.db, ctx.session.user.id);
  }),
});