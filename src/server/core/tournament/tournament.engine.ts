// src/server/core/tournament/tournament.engine.ts
import type { Prisma, PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { fisherYatesShuffle, generateEliminationPhases } from "./tournament.helpers";

type PrismaDb = PrismaClient | Prisma.TransactionClient;
type CreateTournamentInput = Omit<Prisma.TournamentUncheckedCreateInput, "managerId" | "status">;

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

    // Sorteo y creación de fases en transacción atómica
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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

      // Actualizar estado del torneo a IN_PROGRESS
      return tx.tournament.update({
        where: { id: tournamentId },
        data: { status: "IN_PROGRESS" },
      });
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
  }
};