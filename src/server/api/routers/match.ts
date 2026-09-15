import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure, protectedProcedure, managerProcedure } from "torneos/server/api/trpc";
import { matchEngine } from "torneos/server/core/match/match.engine";

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
        include: {
          homeTeam: true,
          awayTeam: true,
          result: true,
          phase: true,   // ← agregado: listByTournament ya lo traía, Detalle Partido lo necesita
          court: true,   // ← agregado: Detalle Partido muestra la sede (quitalo si no aplica)
          referee: true,
          callUps: {
            include: {
              team: {
                select: { id: true, name: true, abbreviation: true, primaryColor: true },
              },
              player: playerWithProfile,
            },
          },
          playerStats: {
            include: {
              team: { select: { id: true, name: true, abbreviation: true } },
              player: playerWithProfile,
            },
          },
        },
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
        include: {
          homeTeam: true,
          awayTeam: true,
          result: true,
          phase: true,
          court: true,
          referee: true,
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
        },
      });

      // t3 estándar: en publicProcedure ctx.session es Session | null
      const userId = ctx.session?.user?.id ?? null;
      if (!match || !userId) return { match, viewer: null };

      const profile = await ctx.db.profile.findUnique({
        where: { userId },
        select: { id: true, player: { select: { id: true } } },
      });
      if (!profile) return { match, viewer: null };

      const playerId = profile.player?.id ?? null;

      // Capitanía VIGENTE — mismo criterio que markAbsent (B-14 cerrado por esta vía)
      const memberships = playerId
        ? await ctx.db.teamMembership.findMany({
            where: { playerId, isCaptain: true, leftAt: null },
            select: { teamId: true },
          })
        : [];

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
          captainOfTeamIds: memberships.map((m) => m.teamId),
          isManager,
        },
      };
    }),

  // ─── B-06a: Capitán marca ausente en su convocatoria ───

  markAbsent: protectedProcedure
    .input(z.object({
      matchId: z.string(),
      playerId: z.string(),
      isAbsent: z.boolean(),
      notes: z.string().max(200).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // 1. El jugador debe estar convocado en ese partido
      const callUp = await ctx.db.matchCallUp.findFirst({
        where: { matchId: input.matchId, playerId: input.playerId },
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
      if (!captaincy) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Solo el capitán del equipo puede marcar ausencias en su convocatoria",
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
  assignReferee: managerProcedure
    .input(z.object({
      matchId: z.string(),
      refereeId: z.string().nullable(), // null = desasignar
    }))
    .mutation(async ({ ctx, input }) => {
      const match = await ctx.db.match.findUnique({
        where: { id: input.matchId },
        select: { status: true },
      });
      if (!match) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Partido no encontrado" });
      }
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
  listReferees: managerProcedure.query(({ ctx }) => {
    return ctx.db.referee.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  }),

  postpone: managerProcedure
    .input(z.object({ matchId: z.string(), reason: z.string().min(10) }))
    .mutation(({ ctx, input }) => {
      return matchEngine.postpone(ctx.db, input.matchId, input.reason, ctx.session.user.id);
    }),

  reschedule: managerProcedure
    .input(z.object({
      matchId: z.string(),
      newDate: z.date(),
      newTimeSlot: z.number().min(1).max(10),
    }))
    .mutation(({ ctx, input }) => {
      return matchEngine.reschedule(ctx.db, input.matchId, input.newDate, input.newTimeSlot, ctx.session.user.id);
    }),

  markWalkover: managerProcedure
    .input(z.object({ matchId: z.string(), winnerTeamId: z.string() }))
    .mutation(({ ctx, input }) => {
      return matchEngine.markWalkover(ctx.db, input.matchId, input.winnerTeamId, ctx.session.user.id);
    }),
});