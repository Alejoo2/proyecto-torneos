import { z } from "zod";
import { createTRPCRouter, protectedProcedure, permissionProcedure } from "torneos/server/api/trpc";
import { teamEngine } from "torneos/server/core/team/team.engine";
import { TRPCError } from "@trpc/server";

export const teamRouter = createTRPCRouter({
  // ==========================================
  // Creación e Invitaciones (Sistema 3 y 4)
  // ==========================================
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

  invitePlayer: permissionProcedure("team:invite")
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

  // ==========================================
  // Consultas (Getters)
  // ==========================================
  getMyTeams: protectedProcedure.query(async ({ ctx }) => {
    const profile = await ctx.db.profile.findUnique({
      where: { userId: ctx.session.user.id },
      include: {
        player: {
          include: {
            teamMemberships: {
              where: { leftAt: null },
              include: { team: true }
            }
          }
        }
      }
    });
    if (!profile?.player) return [];
    return profile.player.teamMemberships.map(m => m.team);
  }),

  getById: protectedProcedure
    .input(z.object({ teamId: z.string() }))
    .query(async ({ ctx, input }) => {
      const team = await ctx.db.team.findUnique({
        where: { id: input.teamId },
        include: {
          memberships: {
            where: { leftAt: null },
            include: {
              player: {
                include: {
                  profile: {
                    select: { 
                      displayName: true, 
                      userId: true, 
                      user: { select: { image: true } } 
                    }
                  }
                }
              }
            },
            orderBy: { isCaptain: "desc" }
          },
          _count: {
            select: { memberships: { where: { leftAt: null } } }
          }
        }
      });

      if (!team) throw new TRPCError({ code: "NOT_FOUND", message: "Equipo no encontrado" });
      return team;
    }),

     requestDelete: protectedProcedure
    .input(z.object({ teamId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return teamEngine.requestDelete(ctx.db, input.teamId, ctx.session.user.id);
    }),

  voteDeletion: protectedProcedure
    .input(z.object({ teamId: z.string(), approve: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return teamEngine.voteDeletion(ctx.db, input.teamId, ctx.session.user.id, input.approve);
    }),

  cancelDeletionRequest: protectedProcedure
    .input(z.object({ teamId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return teamEngine.cancelDeletionRequest(ctx.db, input.teamId, ctx.session.user.id);
    }),
  // ==========================================
  // Gestión de Equipo (Sistema 3)
  // ==========================================
  leaveTeam: protectedProcedure
    .input(z.object({ teamId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return teamEngine.leaveTeam(ctx.db, input.teamId, ctx.session.user.id);
    }),
});