// server/core/tournament/enrollment.engine.ts
import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";

export const enrollmentEngine = {
  async enroll(prisma: PrismaClient, input: { tournamentId: string; teamId: string }, userId: string) {
    // 1. Verificar que el usuario es capitán del teamId
    const membership = await prisma.teamMembership.findFirst({
      where: {
        teamId: input.teamId,
        isCaptain: true,
        leftAt: null,
        player: { profile: { userId } },
      },
    });
    if (!membership) throw new TRPCError({ code: "FORBIDDEN", message: "No eres capitán de este equipo" });

    // 2. Verificar estado del torneo y cupos
    const tournament = await prisma.tournament.findUnique({
      where: { id: input.tournamentId, status: { in: ["SCHEDULED", "GRACE_PERIOD"] } },
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

    const occupiedSlots = tournament._count.enrollments + tournament._count.slotHolds;
    if (occupiedSlots >= tournament.maxTeams) {
      throw new TRPCError({ code: "CONFLICT", message: "No hay cupos disponibles" });
    }

    // 3. Verificar que no existe enrollment previo
    const existing = await prisma.tournamentEnrollment.findUnique({
      where: { tournamentId_teamId: { tournamentId: input.tournamentId, teamId: input.teamId } },
    });
    if (existing) throw new TRPCError({ code: "CONFLICT", message: "Equipo ya inscrito" });

    // 4. Verificar SlotHold activo del capitán
    const hold = await prisma.tournamentSlotHold.findFirst({
      where: {
        tournamentId: input.tournamentId,
        heldBy: membership.playerId,
        expiresAt: { gt: new Date() },
      },
    });
    if (!hold) throw new TRPCError({ code: "FORBIDDEN", message: "No tienes una prereserva activa" });

    // 5. Evaluar Factor 1: disponibilidad horaria
    const teamMembers = await prisma.teamMembership.findMany({
      where: { teamId: input.teamId, leftAt: null },
      include: {
        player: {
          include: {
            availabilities: {
              where: {
                dayOfWeek: tournament.dayOfWeek,
                timeSlot: tournament.timeSlot,
                status: "AVAILABLE"
              },
            },
          },
        },
      },
    });

    const availableCount = teamMembers.filter(tm => tm.player.availabilities.length > 0).length;

    // 6. Crear enrollment y eliminar hold en una transacción
    const [enrollment] = await prisma.$transaction([
      prisma.tournamentEnrollment.create({
        data: {
          tournamentId: input.tournamentId,
          teamId: input.teamId,
          status: availableCount >= 5 ? "PENDING_PAYMENT" : "PENDING_AVAILABILITY",
          availabilityNote: availableCount >= 5 
            ? null 
            : `Solo ${availableCount} de ${teamMembers.length} jugadores disponibles en la franja del torneo`,
        },
      }),
      prisma.tournamentSlotHold.delete({ where: { id: hold.id } })
    ]);

    // Notificación al gestor (Sistema 11 - omitido por ahora)
    return enrollment;
  },

  async approve(prisma: PrismaClient, enrollmentId: string, managerId: string) {
    const enrollment = await prisma.tournamentEnrollment.findUnique({
      where: { id: enrollmentId },
      include: { tournament: true }
    });

    if (!enrollment) throw new TRPCError({ code: "NOT_FOUND", message: "Inscripción no encontrada" });
    if (enrollment.status !== "PENDING_PAYMENT") throw new TRPCError({ code: "BAD_REQUEST", message: "La inscripción no está pendiente de pago" });
    if (enrollment.tournament.managerId !== managerId) throw new TRPCError({ code: "FORBIDDEN", message: "No eres el gestor de este torneo" });

    return prisma.tournamentEnrollment.update({
      where: { id: enrollmentId },
      data: { 
        status: "APPROVED", 
        approvedAt: new Date(), 
        approvedBy: managerId 
      },
    });
  },

  // Aquí irían reject, disapprove, reevaluate...misma estructura.
};