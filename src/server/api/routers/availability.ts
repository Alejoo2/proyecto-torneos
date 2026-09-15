import { createTRPCRouter, protectedProcedure } from "torneos/server/api/trpc";
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
        throw new Error("Jugador no encontrado para este usuario");
      }
      const playerId = profile.player.id;

      return availabilityEngine.toggleSlot(
        ctx.db,
        playerId,
        input.dayOfWeek,
        input.timeSlot
      );
    }),
});