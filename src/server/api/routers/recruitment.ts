import { z } from "zod";
import { createTRPCRouter, protectedProcedure, permissionProcedure } from "torneos/server/api/trpc";
import { recruitmentEngine } from "torneos/server/core/recruitment/recruitment.engine";

export const recruitmentRouter = createTRPCRouter({
  // ==========================================
  // Descubrimiento (Capitán)
  // ==========================================
  searchPlayers: permissionProcedure("team:invite") // Capa 2: Solo usuarios con permiso de invitar
    .input(z.object({
      teamId: z.string(),
      query: z.string().optional(),
      availabilityFilter: z.object({
        dayOfWeek: z.number().min(0).max(6).optional(),
        timeSlot: z.number().min(0).max(11).optional(),
      }).optional(),
      page: z.number().min(1).default(1),
      pageSize: z.number().min(1).max(50).default(20),
    }))
    .query(async ({ ctx, input }) => {
      return recruitmentEngine.searchPlayers(ctx.db, input, ctx.session.user.id);
    }),

  // ==========================================
  // Invitación (Capitán)
  // ==========================================
  invite: permissionProcedure("team:invite")
    .input(z.object({
      teamId: z.string(),
      playerId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      return recruitmentEngine.invite(ctx.db, input, ctx.session.user.id);
    }),

  revokeInvitation: permissionProcedure("team:invite")
    .input(z.object({ invitationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return recruitmentEngine.revokeInvitation(ctx.db, input.invitationId, ctx.session.user.id);
    }),

  // ==========================================
  // Jugador Pasivo (Cualquier usuario logueado)
  // ==========================================
  getMyInvitations: protectedProcedure
    .query(async ({ ctx }) => {
      return recruitmentEngine.getPendingForPlayer(ctx.db, ctx.session.user.id);
    }),

  acceptInvitation: protectedProcedure
    .input(z.object({ invitationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return recruitmentEngine.acceptInvitation(ctx.db, input.invitationId, ctx.session.user.id);
    }),

  rejectInvitation: protectedProcedure
    .input(z.object({ invitationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return recruitmentEngine.rejectInvitation(ctx.db, input.invitationId, ctx.session.user.id);
    }),

      // ==========================================
  // Perfil Público (Capitán)
  // ==========================================
  getPlayerProfile: permissionProcedure("team:invite")
    .input(z.object({
      teamId: z.string(),
      playerId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      return recruitmentEngine.getPlayerProfile(ctx.db, input, ctx.session.user.id);
    }),
});