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

  // ==========================================
  // W9 — Mis estadísticas agregadas (enmienda aditiva AUTORIZADA en maestro)
  // ==========================================
  getMyStats: protectedProcedure.query(async ({ ctx }) => {
    const profile = await ctx.db.profile.findUnique({
      where: { userId: ctx.session.user.id },
      select: { player: { select: { stats: true } } },
    });
    return profile?.player?.stats ?? null;
  }),

  // ==========================================
  // W9 — Historial de mis partidos con stats (enmienda aditiva A3, patrón
  // getMyStats: protected + read-only + resuelve profile→player). Fuente:
  // MatchPlayerStat (shape verificado). "Sin stats" del wireframe requeriría
  // MatchCallUp — registrado como deuda, no se fabrica.
  // ==========================================
  getMyMatchHistory: protectedProcedure.query(async ({ ctx }) => {
    const profile = await ctx.db.profile.findUnique({
      where: { userId: ctx.session.user.id },
      select: { player: { select: { id: true } } },
    });
    const playerId = profile?.player?.id;
    if (!playerId) return [];

    return ctx.db.matchPlayerStat.findMany({
      where: { playerId },
      orderBy: { match: { createdAt: "desc" } },
      take: 10,
      select: {
        matchId: true,
        teamId: true,
        goals: true,
        match: {
          select: {
            tournamentId: true,
            date: true,
            scheduledAt: true,
            status: true,
            phase: { select: { name: true } },
            tournament: { select: { name: true } },
          },
        },
      },
    });
  }),
});