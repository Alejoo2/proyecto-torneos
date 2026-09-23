import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "torneos/server/api/trpc";
import { resultEngine } from "torneos/server/core/stats/result.engine";

const playerStatSchema = z.object({
  playerId: z.string(),
  teamId: z.string(),
  goals: z.number().min(0).default(0),
  blueCards: z.number().min(0).default(0),
  yellowCards: z.number().min(0).default(0),
  redCards: z.number().min(0).default(0),
  fouls: z.number().min(0).default(0),
  ownGoals: z.number().min(0).default(0),
});

export const resultRouter = createTRPCRouter({
  load: protectedProcedure
        .input(z.object({
      matchId: z.string(),
      homeScore: z.number().min(0),
      awayScore: z.number().min(0),
      // D3 (aditivo): observaciones del gestor → MatchResult.notes (@db.Text)
      notes: z.string().max(500).optional(),
      playerStats: z.array(playerStatSchema),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await resultEngine.loadResult(
        ctx.db,
        input.matchId,
        input.homeScore,
        input.awayScore,
        input.playerStats,
        ctx.session.user.id
      );
      // Escritura aditiva posterior al engine: firma y lógica del engine intactas
      if (input.notes?.trim()) {
        await ctx.db.matchResult.update({
          where: { matchId: input.matchId },
          data: { notes: input.notes.trim() },
        });
      }
      return result;
    }),

  getByMatch: protectedProcedure
    .input(z.object({ matchId: z.string() }))
    .query(({ ctx, input }) => {
      return ctx.db.matchResult.findUnique({
        where: { matchId: input.matchId },
        include: { match: { include: { playerStats: true } } }
      });
    }),
});