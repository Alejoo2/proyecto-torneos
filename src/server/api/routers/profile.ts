import { createTRPCRouter, protectedProcedure } from "torneos/server/api/trpc";
import { profileEngine } from "torneos/server/core/profile/profile.engine";
import { z } from "zod";

export const profileRouter = createTRPCRouter({
  me: protectedProcedure.query(({ ctx }) => {
    return profileEngine.getByUserId(ctx.db, ctx.session.user.id);
  }),

  getById: protectedProcedure
    .input(z.object({ profileId: z.string() }))
    .query(({ ctx, input }) => {
      return profileEngine.getPublicProfile(ctx.db, input.profileId, ctx.session.user.id);
    }),

  update: protectedProcedure
    .input(z.object({
      displayName: z.string().min(1).max(50).optional(),
      phone: z.string().max(20).optional(),
      bio: z.string().max(500).optional(),
      birthDate: z.date().optional(),
    }))
    .mutation(({ ctx, input }) => {
      return profileEngine.update(ctx.db, ctx.session.user.id, input);
    }),

  completeOnboarding: protectedProcedure
    .input(z.object({
      displayName: z.string().min(1).max(50),
      phone: z.string().max(20).optional(),
      bio: z.string().max(500).optional(),
      birthDate: z.date().optional(),
    }))
    .mutation(({ ctx, input }) => {
      return profileEngine.completeOnboarding(ctx.db, ctx.session.user.id, input);
    }),
});