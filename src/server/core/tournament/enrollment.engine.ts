// server/core/tournament/enrollment.engine.ts
import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";

export const enrollmentEngine = {
    async enroll(prisma: PrismaClient, input: { tournamentId: string; teamId: string }, userId: string) {
    // 1. Verificar capitán (igual)
    const membership = await prisma.teamMembership.findFirst({
      where: {
        teamId: input.teamId,
        isCaptain: true,
        leftAt: null,
        player: { profile: { userId } },
      },
    });
    if (!membership) throw new TRPCError({ code: "FORBIDDEN", message: "No eres capitán de este equipo" });

    // 2. Verificar torneo y cupos (igual)
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

    // 3. Verificar inscripción previa
    const existing = await prisma.tournamentEnrollment.findUnique({
      where: { tournamentId_teamId: { tournamentId: input.tournamentId, teamId: input.teamId } },
    });
    
    if (existing && !["DISAPPROVED", "REJECTED"].includes(existing.status)) {
      throw new TRPCError({ code: "CONFLICT", message: "Equipo ya inscrito o pendiente" });
    }

    // 4. Verificar Hold (igual)
    const hold = await prisma.tournamentSlotHold.findFirst({
      where: {
        tournamentId: input.tournamentId,
        heldBy: membership.playerId,
        expiresAt: { gt: new Date() },
      },
    });
    if (!hold) throw new TRPCError({ code: "FORBIDDEN", message: "No tienes una prereserva activa" });

    // 5. Evaluar Factor 1 (igual)
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
    const newStatus = availableCount >= 5 ? "PENDING_PAYMENT" : "PENDING_AVAILABILITY";
    const availabilityNote = availableCount >= 5 
      ? null 
      : `Solo ${availableCount} de ${teamMembers.length} jugadores disponibles en la franja del torneo`;

    // 6. Crear o actualizar enrollment (Upsert) y eliminar hold
    const [enrollment] = await prisma.$transaction([
      prisma.tournamentEnrollment.upsert({
        where: { tournamentId_teamId: { tournamentId: input.tournamentId, teamId: input.teamId } },
        update: {
          status: newStatus,
          availabilityNote,
          enrolledAt: new Date(),
          approvedAt: null,
          approvedBy: null,
          disapprovedAt: null,
          disapprovedBy: null,
          disapprovedReason: null,
        },
        create: {
          tournamentId: input.tournamentId,
          teamId: input.teamId,
          status: newStatus,
          availabilityNote,
        },
      }),
      prisma.tournamentSlotHold.delete({ where: { id: hold.id } })
    ]);

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

    async disapprove(prisma: PrismaClient, enrollmentId: string, managerId: string) {
    const enrollment = await prisma.tournamentEnrollment.findUnique({
      where: { id: enrollmentId },
      include: { tournament: true }
    });

    if (!enrollment) throw new TRPCError({ code: "NOT_FOUND", message: "Inscripción no encontrada" });
    if (enrollment.status !== "APPROVED") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Solo se pueden desaprobar inscripciones APPROVED" });
    }
    if (enrollment.tournament.managerId !== managerId) {
      throw new TRPCError({ code: "FORBIDDEN", message: "No eres el gestor de este torneo" });
    }
    if (!["SCHEDULED", "GRACE_PERIOD"].includes(enrollment.tournament.status)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Ya no se pueden desaprobar equipos (torneo iniciado o cancelado)" });
    }

    return prisma.tournamentEnrollment.update({
      where: { id: enrollmentId },
      data: { 
        status: "DISAPPROVED", 
        disapprovedAt: new Date(), 
        disapprovedBy: managerId,
        disapprovedReason: "Pago no verificado o rechazado por el gestor"
      },
    });
  },  // Aquí irían reject, disapprove, reevaluate...misma estructura.
};