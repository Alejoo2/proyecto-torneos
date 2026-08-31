import { createTRPCRouter, protectedProcedure } from "torneos/server/api/trpc";
import { availabilityEngine } from "torneos/server/core/availability/availability.engine";
import { z } from "zod";

export const availabilityRouter = createTRPCRouter({
  getMine: protectedProcedure.query(({ ctx }) => {
    return ctx.db.profile.findUnique({
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
      // 1. Buscamos el perfil usando el userId presente en la sesión
      const profile = await ctx.db.profile.findUnique({
        where: { userId: ctx.session.user.id },
        include: { player: true },
      });

      if (!profile?.player) {
        throw new Error("Jugador no encontrado para este usuario");
      }

      // 2. Ejecutamos el engine pasando ctx.db y el ID del jugador encontrado
      return availabilityEngine.toggleSlot(
        ctx.db,
        profile.player.id,
        input.dayOfWeek,
        input.timeSlot
      );
    }),
});