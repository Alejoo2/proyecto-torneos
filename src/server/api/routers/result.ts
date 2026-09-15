import { z } from "zod";
import { createTRPCRouter, protectedProcedure, managerProcedure } from "torneos/server/api/trpc";
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
  load: managerProcedure
    .input(z.object({
      matchId: z.string(),
      homeScore: z.number().min(0),
      awayScore: z.number().min(0),
      playerStats: z.array(playerStatSchema),
    }))
    .mutation(({ ctx, input }) => {
      return resultEngine.loadResult(
        ctx.db, 
        input.matchId, 
        input.homeScore, 
        input.awayScore, 
        input.playerStats, 
        ctx.session.user.id
      );
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