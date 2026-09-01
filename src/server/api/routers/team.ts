import { z } from "zod";
import { createTRPCRouter, protectedProcedure, permissionProcedure } from "torneos/server/api/trpc";
import { teamEngine } from "torneos/server/core/team/team.engine";

export const teamRouter = createTRPCRouter({
  createDraft: protectedProcedure
    .input(z.object({
      name: z.string().min(2).max(50),
      abbreviation: z.string().min(2).max(10),
      primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
      secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
      description: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return teamEngine.createDraft(ctx.db, input, ctx.session.user.id);
    }),

  invitePlayer: permissionProcedure("team:invite") // Capa 2 de seguridad
    .input(z.object({
      teamId: z.string().optional(),
      playerId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      return teamEngine.invitePlayer(ctx.db, input, ctx.session.user.id);
    }),

  acceptInvitation: protectedProcedure
    .input(z.object({ invitationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return teamEngine.acceptInvitation(ctx.db, input.invitationId, ctx.session.user.id);
    }),

  getById: protectedProcedure
    .input(z.object({ teamId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Implementación básica de getById en el engine
      return ctx.db.team.findUnique({ where: { id: input.teamId }, include: { memberships: true } });
    }),
});