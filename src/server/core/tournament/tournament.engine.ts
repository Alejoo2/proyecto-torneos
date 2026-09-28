// src/server/core/tournament/tournament.engine.ts
import type { Prisma, PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { VITRINE_TOURNAMENT_WHERE } from "torneos/lib/hub";
import { fisherYatesShuffle, generateEliminationPhases, nextWeekdayUTC } from "./tournament.helpers";
import { matchEngine } from "torneos/server/core/match/match.engine";
import { absenceEngine } from "torneos/server/core/tournament/absence.engine";
import { notificationEngine } from "torneos/server/core/notification/notification.engine";

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
  async create(
    prisma: PrismaDb,
    input: CreateTournamentInput & { slots?: { dayOfWeek: number; timeSlot: number }[] },
    userId: string
  ) {    // 1. Verificar que el usuario es gestor activo
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

    // S06 v3.0: la franja también puede estar apartada (reserva concreta de
    // otro torneo publicado). Se mapea la ventana de 14 días a patrón y se
    // exige; el publish valida fecha exacta contra solapes.
    const windowStart = new Date();
    windowStart.setUTCHours(0, 0, 0, 0);
    const windowEnd = new Date(windowStart);
    windowEnd.setUTCDate(windowStart.getUTCDate() + 14);
    const reserved = await prisma.tournamentSlotReservation.findMany({
      where: { courtId: input.courtId, date: { gte: windowStart, lt: windowEnd } },
      select: { date: true, timeSlot: true },
    });
    const reservedPatterns = new Set(
      reserved.map((r) => `${new Date(r.date).getUTCDay()}|${r.timeSlot}`),
    );
    if (reservedPatterns.has(`${input.dayOfWeek}|${input.timeSlot}`)) {
      throw new TRPCError({ code: "CONFLICT", message: "Franja apartada por otro torneo" });
    }

    // W11 — E5 (aditivo): multi-franja. Sin `slots` → comportamiento actual intacto.
    // Conflicto validado por CADA franja marcada (la principal ya se validó arriba).
    const extraSlots = (input.slots ?? []).filter(
      (s) => !(s.dayOfWeek === input.dayOfWeek && s.timeSlot === input.timeSlot),
    );
    for (const s of extraSlots) {
      const slotConflict = await prisma.tournament.findFirst({
        where: {
          courtId: input.courtId,
          dayOfWeek: s.dayOfWeek,
          timeSlot: s.timeSlot,
          status: { in: ["SCHEDULED", "GRACE_PERIOD", "IN_PROGRESS"] },
        },
      });
      if (slotConflict) {
        throw new TRPCError({ code: "CONFLICT", message: "Una de las franjas marcadas está ocupada por otro torneo" });
      }
    }

    // 5. Crear torneo — `slots` viaja aparte del spread de escalares
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- _slots se omite a proposito
    const { slots: _slots, ...scalarInput } = input;
    return prisma.tournament.create({
      data: {
        ...scalarInput,
        managerId: manager.id,
        status: "DRAFT",
        ...(extraSlots.length > 0
          ? {
              slots: {
                create: extraSlots.map((s) => ({ dayOfWeek: s.dayOfWeek, timeSlot: s.timeSlot })),
              },
            }
          : {}),
      },
    });
  },

  async publish(prisma: PrismaClient, tournamentId: string, userId: string) {
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

    // S06 v3.0: al publicar se apartan maxTeams-1 franjas concretas desde la
    // fecha base. En ese instante quedan bloqueadas: otro torneo no puede
    // escogerlas (ver check en create + overlap aquí).
    const base = nextWeekdayUTC(
      tournament.startDate ?? new Date(),
      tournament.dayOfWeek,
    );
    const dates: Date[] = [];
    for (let i = 0; i < tournament.maxTeams - 1; i++) {
      const d = new Date(base);
      d.setUTCDate(base.getUTCDate() + i * 7);
      dates.push(d);
    }
    const taken = await prisma.tournamentSlotReservation.findFirst({
      where: {
        courtId: tournament.courtId,
        tournamentId: { not: tournamentId },
        OR: dates.map((date) => ({ date, timeSlot: tournament.timeSlot })),
      },
      select: { id: true },
    });
    if (taken) {
      throw new TRPCError({ code: "CONFLICT", message: "Franja apartada por otro torneo" });
    }

    return prisma.$transaction(async (tx) => {
      await tx.tournamentSlotReservation.createMany({
        data: dates.map((date) => ({
          tournamentId,
          courtId: tournament.courtId,
          date,
          timeSlot: tournament.timeSlot,
        })),
        skipDuplicates: true,
      });
      await tx.courtAvailability.updateMany({
        where: { courtId: tournament.courtId, date: { in: dates }, timeSlot: tournament.timeSlot },
        data: { status: "UNAVAILABLE" },
      });
      return tx.tournament.update({
        where: { id: tournamentId },
        data: { status: "SCHEDULED" },
      });
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

    const shuffledTeams = fisherYatesShuffle(approvedTeams.map(e => ({ id: e.teamId })));
    const phasesData = generateEliminationPhases(shuffledTeams.length);

    // Sorteo y creación de fases en transacción atómica.
    // Timeout extendido (default 5s): generateFromDraw notifica convocado-por-
    // convocado dentro de la tx (~2 queries c/u) — con 30 convocados son ~17
    // round-trips (6.4s medidos en dev). Deuda B-18: el loop secuencial no
    // escala a brackets de 32 equipos; batch de notificaciones pendiente.
    return prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
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
    ).then(async (updated) => {
      // Rojo del sorteo FUERA de la tx (mismo motivo que enroll: el detect es
      // caro y el timeout es compartido). Best-effort, no bloquea el sorteo.
      try {
        for (const t of shuffledTeams) {
          const hard = await absenceEngine.teamHardConflicts(
            prisma, t.id, tournament.dayOfWeek, tournament.timeSlot,
          );
          for (const h of hard) {
            const names = h.otherTournaments.map((o) => o.name).join(" vs ");
            await notificationEngine.create(prisma, {
              userId: h.userId,
              family: "TOURNAMENT",
              type: "TOURNAMENT_CONFLICT",
              title: `Conflicto en ${tournament.name}: elige cancha`,
              body: `Tienes ${h.otherTournaments.length} torneos en la misma franja (${names}). Márcate ausente en uno para quitar el rojo.`,
              payload: {
                tournamentId: tournament.id,
                teamId: t.id,
                dayOfWeek: tournament.dayOfWeek,
                timeSlot: tournament.timeSlot,
              },
            });
          }
        }
      } catch (e) {
        console.error("Aviso de rojo post-sorteo falló (no bloqueante):", e);
      }
      return updated;
    });
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

  /** W11 — E4 (H-D): torneos del gestor en TODOS los estados (DRAFT/PRIVATE incluidos).
   *  Deliberadamente SIN VITRINE_TOURNAMENT_WHERE: la vitrina excluye justo lo que
   *  esta query busca. Read-model de gestor, no de vitrina (misma frontera que
   *  getById vs getPublicById). courtId? filtra para una cancha (flujo "cancha manda"). */
  async listMine(prisma: PrismaDb, userId: string, courtId?: string) {
    const manager = await prisma.manager.findFirst({
      where: { profile: { userId }, isActive: true },
      select: { id: true },
    });
    if (!manager) return [];
    return prisma.tournament.findMany({
      where: { managerId: manager.id, ...(courtId ? { courtId } : {}) },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        type: true,
        courtId: true,
        maxTeams: true,
        dayOfWeek: true,
        timeSlot: true,
        enrollmentDeadline: true,
        startDate: true,
        createdAt: true,
        _count: { select: { enrollments: true } },
      },
    });
  },
};