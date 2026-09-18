// src/server/core/tournament/tournament.engine.ts
import type { Prisma, PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { VITRINE_TOURNAMENT_WHERE } from "torneos/lib/hub";
import { fisherYatesShuffle, generateEliminationPhases } from "./tournament.helpers";
import { matchEngine } from "torneos/server/core/match/match.engine";

type PrismaDb = PrismaClient | Prisma.TransactionClient;
type CreateTournamentInput = Omit<Prisma.TournamentUncheckedCreateInput, "managerId" | "status">;

/**
 * Read-models de vitrina anónima (capa 1). Deliberadamente NUEVOS en vez de
 * recortar getById: el contrato del gestor (manager.profile, PENDING_*,
 * slotHolds) es otro read-model y mezclarlos filtra PII a destiempo.
 * ALLOWLIST de campos: solo lo que la vitrina muestra. Sin manager, sin holds.
 */
const vitrineCardSelect = {
  id: true,
  name: true,
  status: true,
  dayOfWeek: true,
  timeSlot: true,
  maxTeams: true,
  enrollmentDeadline: true,
  court: { select: { id: true, name: true } },
  _count: { select: { enrollments: { where: { status: "APPROVED" } } } },
} satisfies Prisma.TournamentSelect;

const vitrineDetailSelect = {
  ...vitrineCardSelect,
  description: true,
  format: true,
  startDate: true,
  court: {
    select: { id: true, name: true, address: true, lat: true, lon: true },
  },
  enrollments: {
    where: { status: "APPROVED" },
    select: {
      id: true,
      enrolledAt: true,
      status: true,           // ← LÍNEA NUEVA
      availabilityNote: true, // ← LÍNEA NUEVA
      team: {
        select: {
          id: true,
          name: true,
          abbreviation: true,
          primaryColor: true,
          secondaryColor: true,
        },
      },
    },
    orderBy: { enrolledAt: "asc" as const },
  },
} satisfies Prisma.TournamentSelect;

export const tournamentEngine = {
  async create(prisma: PrismaDb, input: CreateTournamentInput, userId: string) {
    // 1. Verificar que el usuario es gestor activo
    const manager = await prisma.manager.findFirst({
      where: { profile: { userId }, isActive: true },
    });
    if (!manager) throw new TRPCError({ code: "FORBIDDEN", message: "No eres gestor activo" });

    // 2. Verificar cancha habilitada
    const court = await prisma.court.findUnique({
      where: { id: input.courtId, status: "ENABLED" },
    });
    if (!court) throw new TRPCError({ code: "NOT_FOUND", message: "Cancha no encontrada o deshabilitada" });

    // 3. Validar potencia de 2
    if (!Number.isInteger(Math.log2(input.maxTeams)) || input.maxTeams < 2) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "maxTeams debe ser potencia de 2 (mínimo 2)" });
    }

    // 4. Validar franja ocupada
    const conflictingTournament = await prisma.tournament.findFirst({
      where: {
        courtId: input.courtId,
        dayOfWeek: input.dayOfWeek,
        timeSlot: input.timeSlot,
        status: { in: ["SCHEDULED", "GRACE_PERIOD", "IN_PROGRESS"] },
      },
    });
    if (conflictingTournament) {
      throw new TRPCError({ code: "CONFLICT", message: "Franja horaria ocupada por otro torneo" });
    }

    // 5. Crear torneo
    return prisma.tournament.create({
      data: {
        ...input,
        managerId: manager.id,
        status: "DRAFT",
      },
    });
  },

  async publish(prisma: PrismaDb, tournamentId: string, userId: string) {
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: { manager: { include: { profile: true } } },
    });

    if (!tournament) throw new TRPCError({ code: "NOT_FOUND", message: "Torneo no encontrado" });
    if (tournament.manager.profile.userId !== userId) {
      throw new TRPCError({ code: "FORBIDDEN", message: "No eres el gestor de este torneo" });
    }
    if (tournament.status !== "DRAFT") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "El torneo debe estar en estado DRAFT para publicarse" });
    }

    return prisma.tournament.update({
      where: { id: tournamentId },
      data: { status: "SCHEDULED" },
    });
  },

  async closeAndDraw(prisma: PrismaClient, tournamentId: string, userId: string) {
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: { 
        manager: { include: { profile: true } },
        enrollments: { where: { status: "APPROVED" } },
      },
    });

    if (!tournament) throw new TRPCError({ code: "NOT_FOUND", message: "Torneo no encontrado" });
    if (tournament.manager.profile.userId !== userId) {
      throw new TRPCError({ code: "FORBIDDEN", message: "No eres el gestor de este torneo" });
    }
    if (tournament.status !== "SCHEDULED") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "El torneo no está en fase de inscripción" });
    }

    const approvedTeams = tournament.enrollments;
    if (approvedTeams.length < 2 || !Number.isInteger(Math.log2(approvedTeams.length))) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Debe haber al menos 2 equipos aprobados y ser potencia de 2" });
    }

    // Sorteo y creación de fases en transacción atómica.
    // Timeout extendido (default 5s): generateFromDraw notifica convocado-por-
    // convocado dentro de la tx (~2 queries c/u) — con 30 convocados son ~17
    // round-trips (6.4s medidos en dev). Deuda B-18: el loop secuencial no
    // escala a brackets de 32 equipos; batch de notificaciones pendiente.
    return prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
      const shuffledTeams = fisherYatesShuffle(approvedTeams.map(e => ({ id: e.teamId })));
      const phasesData = generateEliminationPhases(shuffledTeams.length);

      // Crear fases
      await Promise.all(
        phasesData.map(p => tx.tournamentPhase.create({
          data: {
            tournamentId: tournament.id,
            name: p.name,
            order: p.order,
          }
        }))
      );

      // ─── W5-fix: conectar la pieza huérfana del match engine ───
      // generateFromDraw fue construida para este destino (su comentario
      // original lo declaraba: "DENTRO de la transacción de closeAndDraw")
      // y nunca fue invocada. Pre-crea el bracket completo (rondas futuras
      // con equipos null), agenda fechas semanales por ronda y materializa
      // convocatorias + notificaciones MATCH_SCHEDULED para la ronda 1.
      // Requiere el helper con order por secuencia de juego (ronda 1 = order 1).
      await matchEngine.generateFromDraw(
        tx,
        tournament.id,
        shuffledTeams,
        tournament.dayOfWeek,
        tournament.timeSlot,
      );

            // Actualizar estado del torneo a IN_PROGRESS
      return tx.tournament.update({
        where: { id: tournamentId },
        data: { status: "IN_PROGRESS" },
      });
      },
      { timeout: 20000 },
    );
  },

  async getById(prisma: PrismaDb, tournamentId: string) {
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        court: true,
        manager: { include: { profile: true } },
        enrollments: {
          include: { team: true },
          where: { status: { in: ["APPROVED", "PENDING_PAYMENT", "PENDING_AVAILABILITY"] } }
        },
        _count: {
          select: {
            slotHolds: { where: { expiresAt: { gt: new Date() } } },
          }
        }
      },
    });

    if (!tournament) throw new TRPCError({ code: "NOT_FOUND", message: "Torneo no encontrado" });
    return tournament;

  },
    async cancel(prisma: PrismaClient, tournamentId: string, userId: string) {
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: { manager: { include: { profile: true } } },
    });

    if (!tournament) throw new TRPCError({ code: "NOT_FOUND", message: "Torneo no encontrado" });
    if (tournament.manager.profile.userId !== userId) {
      throw new TRPCError({ code: "FORBIDDEN", message: "No eres el gestor de este torneo" });
    }
    if (tournament.status === "IN_PROGRESS") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "No se puede cancelar un torneo en progreso. Debes reagendarlo." });
    }

    return prisma.tournament.update({
      where: { id: tournamentId },
      data: { status: "CANCELLED" },
    });
  },

    // ==========================================
  // VITRINA ANÓNIMA (publicProcedure en el router)
  // type PUBLIC + status publicado → si no califica, NOT_FOUND (nunca 401:
  // no delata existencia a medias de torneos PRIVATE/DRAFT).
  // ==========================================

  /** Catálogo de torneos de vitrina (lista /torneos anónima). */
  async listPublic(prisma: PrismaDb) {
    return prisma.tournament.findMany({
      where: VITRINE_TOURNAMENT_WHERE,
      select: vitrineCardSelect,
      orderBy: { createdAt: "desc" },
    });
  },

  /** Torneos de vitrina de una cancha (detalle /canchas/:id anónimo). */
  async listByCourtPublic(prisma: PrismaDb, courtId: string) {
    return prisma.tournament.findMany({
      where: { courtId, ...VITRINE_TOURNAMENT_WHERE },
      select: vitrineCardSelect,
      orderBy: { createdAt: "asc" },
    });
  },

  /** Detalle de vitrina /torneos/:id anónimo. Cupos = APPROVED, sin holds. */
  async getPublicById(prisma: PrismaDb, tournamentId: string) {
    const tournament = await prisma.tournament.findFirst({
      where: { id: tournamentId, ...VITRINE_TOURNAMENT_WHERE },
      select: vitrineDetailSelect,
    });

    if (!tournament) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Torneo no encontrado" });
    }
    return tournament;
  },
};