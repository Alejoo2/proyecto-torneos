import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "torneos/server/api/trpc";

export const statsRouter = createTRPCRouter({
  getPlayerStats: protectedProcedure
    .input(z.object({ playerId: z.string() }))
    .query(({ ctx, input }) => {
      return ctx.db.playerStats.findUnique({ where: { playerId: input.playerId } });
    }),

  getTeamStats: protectedProcedure
    .input(z.object({ teamId: z.string() }))
    .query(({ ctx, input }) => {
      return ctx.db.teamStats.findUnique({ where: { teamId: input.teamId } });
    }),

  getTournamentStandings: protectedProcedure
    .input(z.object({ tournamentId: z.string() }))
    .query(({ ctx, input }) => {
      return ctx.db.tournamentStanding.findMany({
        where: { tournamentId: input.tournamentId },
        include: { team: true },
        orderBy: { position: "asc" },
      });
    }),

  // ─── B-03: Tabla de posiciones pública (anónimos) ───
  // Decisión aplicada: pública si el torneo es PUBLIC y no está en DRAFT ni CANCELLED.
  // FINISHED sigue visible (histórico). Si querés otra regla, es el if de abajo.
  getTournamentStandingsPublic: publicProcedure
    .input(z.object({ tournamentId: z.string() }))
    .query(async ({ ctx, input }) => {
      const tournament = await ctx.db.tournament.findUnique({
        where: { id: input.tournamentId },
        select: { type: true, status: true },
      });

      if (
        !tournament ||
        tournament.type === "PRIVATE" ||
        tournament.status === "DRAFT" ||
        tournament.status === "CANCELLED"
      ) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Torneo no disponible" });
      }

      return ctx.db.tournamentStanding.findMany({
        where: { tournamentId: input.tournamentId },
        include: {
          team: {
            select: { id: true, name: true, abbreviation: true, primaryColor: true },
          },
        },
        orderBy: { position: "asc" },
      });
    }),
});