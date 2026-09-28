import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { Prisma } from "@prisma/client";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "torneos/server/api/trpc";
import { matchEngine, getMatchForManagerAction } from "torneos/server/core/match/match.engine";
// Estados en los que ya no se puede tocar el partido
const EDITABLE_BLOCKERS = ["FINISHED", "WALKOVER", "CANCELLED"];

// Perfil mínimo de jugador para convocatoria y stats (B-01)
const playerWithProfile = {
  include: {
    profile: {
      select: {
        displayName: true,
        user: { select: { image: true } },
      },
    },
  },
};

// Fase B: read-model mínimo del detalle (bytes, no forma). El front consume
// solo id/name/abbreviation/primaryColor (TeamChip + wizard), court/referee/
// phase por nombre y result por marcador+notas. description/inventory (Text)
// y el PII del árbitro (phone/email, antes expuesto hasta en la pública)
// ya no viajan — tsc vigila cada campo que el front lea.
const matchDetailInclude = {
  homeTeam: { select: { id: true, name: true, abbreviation: true, primaryColor: true } },
  awayTeam: { select: { id: true, name: true, abbreviation: true, primaryColor: true } },
  result: { select: { homeScore: true, awayScore: true, winnerId: true, isWalkover: true, notes: true } },
  phase: { select: { id: true, name: true } },
  court: { select: { id: true, name: true } },
  referee: { select: { id: true, name: true } },
  callUps: {
    include: {
      team: { select: { id: true, name: true, abbreviation: true, primaryColor: true } },
      player: playerWithProfile,
    },
  },
  playerStats: {
    include: {
      team: { select: { id: true, name: true, abbreviation: true } },
      player: playerWithProfile,
    },
  },
} satisfies Prisma.MatchInclude;

export const matchRouter = createTRPCRouter({
  listByTournament: protectedProcedure
    .input(z.object({ tournamentId: z.string() }))
    .query(({ ctx, input }) => {
      return ctx.db.match.findMany({
        where: { tournamentId: input.tournamentId },
        include: { homeTeam: true, awayTeam: true, result: true, phase: true },
      });
    }),

  // B-01: callUps y playerStats ahora traen displayName + image
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) => {
      return ctx.db.match.findUnique({
        where: { id: input.id },
        include: matchDetailInclude,
      });
    }),

  // ─── B-06a: Capitán marca ausente en su convocatoria ───
  // Sin migración: isAbsent/markedBy/markedAt/notes ya existen en el schema.
  // ─── PANTALLA 6: lectura pública (enmienda aditiva D1-b, misma naturaleza que B-13) ───
  // Mismo include que getById + bloque `viewer` resuelto en server: decide QUÉ renderiza
  // el front (panel de capitán, link de gestión). NO reemplaza la autorización real:
  // markAbsent sigue validando capitanía vigente server-side (§7.7).
  getByIdPublic: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const match = await ctx.db.match.findUnique({
        where: { id: input.id },
        include: matchDetailInclude,
      });

      // t3 estándar: en publicProcedure ctx.session es Session | null
      const userId = ctx.session?.user?.id ?? null;
      if (!match || !userId) return { match, viewer: null };

      // Fase B: perfil + capitanías en 1 viaje (antes: profile y memberships secuenciales).
      const profile = await ctx.db.profile.findUnique({
        where: { userId },
        select: {
          id: true,
          player: {
            select: {
              id: true,
              teamMemberships: {
                where: { isCaptain: true, leftAt: null },
                select: { teamId: true },
              },
            },
          },
        },
      });
      if (!profile) return { match, viewer: null };

      const playerId = profile.player?.id ?? null;
      const captainOfTeamIds = profile.player?.teamMemberships.map((m) => m.teamId) ?? [];

      // "Gestionar" solo al gestor de ESTE torneo (front sugiere por ownership;
      // el backend autoriza por permiso en cada mutación)
      const [managerRow, tournamentRow] = await Promise.all([
        ctx.db.manager.findUnique({
          where: { profileId: profile.id },
          select: { id: true, isActive: true },
        }),
        ctx.db.tournament.findUnique({
          where: { id: match.tournamentId },
          select: { managerId: true },
        }),
      ]);
      const isManager = !!managerRow?.isActive && managerRow.id === tournamentRow?.managerId;

      return {
        match,
        viewer: {
          userId,
          playerId,
          captainOfTeamIds,
          isManager,
        },
      };
    }),

  // ─── B-06a: Capitán marca ausente en su convocatoria ───

  markAbsent: protectedProcedure
    .input(z.object({
      matchId: z.string(),
      teamId: z.string(),
      playerId: z.string(),
      isAbsent: z.boolean(),
      notes: z.string().max(200).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // 1. El jugador debe estar convocado en ese partido Y ese equipo
      // (un jugador en los dos equipos marca por equipo, no global).
      const callUp = await ctx.db.matchCallUp.findFirst({
        where: { matchId: input.matchId, teamId: input.teamId, playerId: input.playerId },
        include: { match: { select: { status: true } } },
      });
      if (!callUp) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "El jugador no está convocado para este partido",
        });
      }

      // 2. El partido debe ser editable
      if (EDITABLE_BLOCKERS.includes(callUp.match.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No se puede modificar la convocatoria de un partido finalizado",
        });
      }

      // 3. Solo el capitán VIGENTE del equipo convocado puede marcar (§7.7)
      const profile = await ctx.db.profile.findUnique({
        where: { userId: ctx.session.user.id },
        select: { player: { select: { id: true } } },
      });
      const callerPlayerId = profile?.player?.id;
      if (!callerPlayerId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Solo los jugadores pueden marcar ausencias",
        });
      }

      const captaincy = await ctx.db.teamMembership.findFirst({
        where: {
          teamId: callUp.teamId,
          playerId: callerPlayerId,
          isCaptain: true,
          leftAt: null,
        },
      });
      // S02/Fase 2: el jugador puede marcarse a SÍ MISMO (auto-ausencia en el
      // partido); a otros solo el capitán vigente. markedBy audita quién fue.
      if (callerPlayerId !== input.playerId && !captaincy) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Solo el capitán marca ausencias ajenas; las propias las marca cada jugador",
        });
      }

      // 4. Marcar. markedBy/markedAt quedan como "última marca" (auditoría del toggle)
      return ctx.db.matchCallUp.update({
        where: { id: callUp.id },
        data: {
          isAbsent: input.isAbsent,
          markedBy: ctx.session.user.id,
          markedAt: new Date(),
          notes: input.notes ?? undefined,
        },
      });
    }),

  // ─── B-06b: Gestor asigna/quita árbitro ───
  assignReferee: protectedProcedure
    .input(z.object({
      matchId: z.string(),
      refereeId: z.string().nullable(), // null = desasignar
    }))
        .mutation(async ({ ctx, input }) => {
      // W11 — E3/H-1: ownership (gestor o delegado). El helper lanza NOT_FOUND/FORBIDDEN.
      const match = await getMatchForManagerAction(ctx.db, input.matchId, ctx.session.user.id, "referee:assign");
      if (EDITABLE_BLOCKERS.includes(match.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No se puede modificar un partido finalizado",
        });
      }

      // Validar que el árbitro exista y esté activo (solo al asignar)
      if (input.refereeId) {
        const referee = await ctx.db.referee.findUnique({
          where: { id: input.refereeId },
          select: { isActive: true },
        });
        if (!referee?.isActive) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Árbitro inexistente o inactivo",
          });
        }
      }

      return ctx.db.match.update({
        where: { id: input.matchId },
        data: { refereeId: input.refereeId },
      });
    }),

  // ─── B-06b: Listado de árbitros para el selector del gestor ───
  // managerProcedure y no protected: phone/email del Referee son PII
  listReferees: protectedProcedure.query(({ ctx }) => {
    return ctx.db.referee.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  }),

  postpone: protectedProcedure
    .input(z.object({ matchId: z.string(), reason: z.string().min(10) }))
    .mutation(({ ctx, input }) => {
      return matchEngine.postpone(ctx.db, input.matchId, input.reason, ctx.session.user.id);
    }),

  reschedule: protectedProcedure
    .input(z.object({
      matchId: z.string(),
      newDate: z.coerce.date(),
            newTimeSlot: z.number().min(0).max(11),
    }))
    .mutation(({ ctx, input }) => {
      return matchEngine.reschedule(ctx.db, input.matchId, input.newDate, input.newTimeSlot, ctx.session.user.id);
    }),

  markWalkover: protectedProcedure
    .input(z.object({ matchId: z.string(), winnerTeamId: z.string() }))
    .mutation(({ ctx, input }) => {
      return matchEngine.markWalkover(ctx.db, input.matchId, input.winnerTeamId, ctx.session.user.id);
    }),
});