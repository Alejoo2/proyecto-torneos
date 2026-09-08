// server/core/tournament/slotHold.engine.ts
import type { Prisma, PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";

const HOLD_DURATION_MS = 5 * 60 * 1000; // 5 minutos

// Tipo seguro compatible con PrismaClient y transacciones sin caer en 'any'
type PrismaDb = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"> | Prisma.TransactionClient;

export const slotHoldEngine = {
  async hold(prisma: PrismaDb, tournamentId: string, userId: string) {
    // 1. Verificar que el usuario es capitán de algún equipo
    const captainMemberships = await prisma.teamMembership.findFirst({
      where: {
        isCaptain: true,
        leftAt: null,
        player: { profile: { userId } },
      },
    });

    if (!captainMemberships) {
      throw new TRPCError({ code: "FORBIDDEN", message: "No eres capitán de ningún equipo" });
    }

    // 2. Verificar que el torneo está SCHEDULED
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId, status: "SCHEDULED" },
      include: {
        _count: {
          select: {
            enrollments: { where: { status: { in: ["APPROVED", "PENDING_PAYMENT"] } } },
            slotHolds: { where: { expiresAt: { gt: new Date() } } },
          },
        },
      },
    });

    if (!tournament) throw new TRPCError({ code: "NOT_FOUND", message: "Torneo no disponible" });

    // 3. Verificar cupos disponibles
    const occupied = tournament._count.enrollments + tournament._count.slotHolds;
    if (occupied >= tournament.maxTeams) {
      throw new TRPCError({ code: "CONFLICT", message: "No hay cupos disponibles" });
    }

    // 4. Verificar si ya tiene un hold activo
    const existingHold = await prisma.tournamentSlotHold.findFirst({
      where: {
        tournamentId,
        heldBy: captainMemberships.playerId,
        expiresAt: { gt: new Date() },
      },
    });

    if (existingHold) {
      // Renovar el hold existente
      return prisma.tournamentSlotHold.update({
        where: { id: existingHold.id },
        data: { expiresAt: new Date(Date.now() + HOLD_DURATION_MS) },
      });
    }

    // 5. Crear nuevo hold
    return prisma.tournamentSlotHold.create({
      data: {
        tournamentId,
        heldBy: captainMemberships.playerId,
        expiresAt: new Date(Date.now() + HOLD_DURATION_MS),
      },
    });
  },

  async check(prisma: PrismaDb, tournamentId: string, userId: string) {
    const player = await prisma.player.findFirst({
      where: { profile: { userId } },
    });
    if (!player) return null;

    const hold = await prisma.tournamentSlotHold.findFirst({
      where: {
        tournamentId,
        heldBy: player.id,
        expiresAt: { gt: new Date() },
      },
    });

    if (!hold) return null;

    return {
      expiresAt: hold.expiresAt,
      secondsRemaining: Math.max(0, Math.floor((hold.expiresAt.getTime() - Date.now()) / 1000)),
    };
  },

  // Para un futuro cron job
  async cleanupExpired(prisma: PrismaDb) {
    return prisma.tournamentSlotHold.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    });
  },
};