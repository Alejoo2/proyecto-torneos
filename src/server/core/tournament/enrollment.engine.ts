// src/server/core/tournament/enrollment.engine.ts
import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { notificationEngine } from "../notification/notification.engine";

export const enrollmentEngine = {
  async enroll(prisma: PrismaClient, input: { tournamentId: string; teamId: string }, userId: string) {
    // 1. Verificar capitán
    const membership = await prisma.teamMembership.findFirst({
      where: {
        teamId: input.teamId,
        isCaptain: true,
        leftAt: null,
        player: { profile: { userId } },
      },
    });
    if (!membership) throw new TRPCError({ code: "FORBIDDEN", message: "No eres capitán de este equipo" });

    // 2. Verificar torneo y cupos (Incluimos manager.profile para la notificación)
    const tournament = await prisma.tournament.findUnique({
      where: { id: input.tournamentId, status: { in: ["SCHEDULED", "GRACE_PERIOD"] } },
      include: {
        manager: { include: { profile: true } }, // NUEVO
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

    // 4. Verificar Hold
    const hold = await prisma.tournamentSlotHold.findFirst({
      where: {
        tournamentId: input.tournamentId,
        heldBy: membership.playerId,
        expiresAt: { gt: new Date() },
      },
    });
    if (!hold) throw new TRPCError({ code: "FORBIDDEN", message: "No tienes una prereserva activa" });

    // 5. Evaluar Factor 1 (Disponibilidad horaria)
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

    // 6. Crear o actualizar enrollment (Upsert), eliminar hold y Notificar en transacción
    const enrollment = await prisma.$transaction(async (tx) => {
      const upserted = await tx.tournamentEnrollment.upsert({
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
      });

      await tx.tournamentSlotHold.delete({ where: { id: hold.id } });

      // NUEVO: Notificar al gestor del torneo
      await notificationEngine.create(tx, {
        userId: tournament.manager.profile.userId,
        family: "TOURNAMENT",
        type: "ENROLLMENT_SUBMITTED",
        title: "Nueva inscripción recibida",
        body: `Un equipo ha solicitado inscribirse en ${tournament.name}`,
        payload: { tournamentId: input.tournamentId, enrollmentId: upserted.id, teamId: input.teamId }
      });

      return upserted;
    });

    return enrollment;
  },

  async approve(prisma: PrismaClient, enrollmentId: string, managerId: string) {
    // Incluimos el equipo y la membresía del capitán para notificarle
    const enrollment = await prisma.tournamentEnrollment.findUnique({
      where: { id: enrollmentId },
      include: { 
        tournament: true,
        team: { 
          include: { 
            memberships: { 
              where: { isCaptain: true, leftAt: null }, 
              include: { player: { include: { profile: true } } } 
            } 
          } 
        } 
      }
    });

    if (!enrollment) throw new TRPCError({ code: "NOT_FOUND", message: "Inscripción no encontrada" });
    if (enrollment.status !== "PENDING_PAYMENT") throw new TRPCError({ code: "BAD_REQUEST", message: "La inscripción no está pendiente de pago" });
    if (enrollment.tournament.managerId !== managerId) throw new TRPCError({ code: "FORBIDDEN", message: "No eres el gestor de este torneo" });

    return prisma.$transaction(async (tx) => {
      const updated = await tx.tournamentEnrollment.update({
        where: { id: enrollmentId },
        data: { 
          status: "APPROVED", 
          approvedAt: new Date(), 
          approvedBy: managerId 
        },
      });

      // NUEVO: Notificar al capitán del equipo
      const captain = enrollment.team.memberships[0]?.player.profile;
      if (captain?.userId) {
        await notificationEngine.create(tx, {
          userId: captain.userId,
          family: "TOURNAMENT",
          type: "ENROLLMENT_APPROVED",
          title: "¡Inscripción aprobada!",
          body: `La inscripción de ${enrollment.team.name} en ${enrollment.tournament.name} ha sido aprobada`,
          payload: { tournamentId: enrollment.tournamentId, teamId: enrollment.teamId }
        });
      }

      return updated;
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
  },
    async reject(prisma: PrismaClient, enrollmentId: string, managerId: string, reason: string) {
    const enrollment = await prisma.tournamentEnrollment.findUnique({
      where: { id: enrollmentId },
      include: { 
        tournament: true,
        team: { 
          include: { 
            memberships: { 
              where: { isCaptain: true, leftAt: null }, 
              include: { player: { include: { profile: true } } } 
            } 
          } 
        } 
      }
    });

    if (!enrollment) throw new TRPCError({ code: "NOT_FOUND", message: "Inscripción no encontrada" });
    if (enrollment.tournament.managerId !== managerId) throw new TRPCError({ code: "FORBIDDEN", message: "No eres el gestor de este torneo" });
    
    // Solo se pueden rechazar inscripciones que estén en fase de revisión (no aprobadas ni ya rechazadas)
    if (!["PENDING_AVAILABILITY", "PENDING_PAYMENT"].includes(enrollment.status)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Esta inscripción ya fue procesada o aprobada" });
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.tournamentEnrollment.update({
        where: { id: enrollmentId },
        data: { 
          status: "REJECTED", 
          disapprovedAt: new Date(), 
          disapprovedBy: managerId,
          disapprovedReason: reason
        },
      });

      // Notificar al capitán del equipo
      const captain = enrollment.team.memberships[0]?.player.profile;
      if (captain?.userId) {
        await notificationEngine.create(tx, {
          userId: captain.userId,
          family: "TOURNAMENT",
          type: "ENROLLMENT_REJECTED",
          title: "Inscripción Rechazada",
          body: `Tu inscripción en ${enrollment.tournament.name} ha sido rechazada. Motivo: ${reason}`,
          payload: { tournamentId: enrollment.tournamentId, teamId: enrollment.teamId }
        });
      }

      return updated;
    });
  },

  async reevaluate(prisma: PrismaClient, enrollmentId: string, userId: string) {
    const enrollment = await prisma.tournamentEnrollment.findUnique({
      where: { id: enrollmentId },
      include: { 
        tournament: { include: { manager: { include: { profile: true } } } } 
      }
    });

    if (!enrollment) throw new TRPCError({ code: "NOT_FOUND", message: "Inscripción no encontrada" });
    if (enrollment.status !== "PENDING_AVAILABILITY") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "La inscripción no está pendiente por disponibilidad" });
    }

    // 1. Verificar que quien llama es el capitán del equipo
    const membership = await prisma.teamMembership.findFirst({
      where: { 
        teamId: enrollment.teamId, 
        isCaptain: true, 
        leftAt: null, 
        player: { profile: { userId } } 
      }
    });
    if (!membership) throw new TRPCError({ code: "FORBIDDEN", message: "Solo el capitán puede reevaluar la inscripción" });

    // 2. Contar disponibles (Misma lógica que en enroll)
    const teamMembers = await prisma.teamMembership.findMany({
      where: { teamId: enrollment.teamId, leftAt: null },
      include: {
        player: {
          include: {
            availabilities: {
              where: {
                dayOfWeek: enrollment.tournament.dayOfWeek,
                timeSlot: enrollment.tournament.timeSlot,
                status: "AVAILABLE"
              },
            },
          },
        },
      },
    });

    const availableCount = teamMembers.filter(tm => tm.player.availabilities.length > 0).length;

    // 3. Si ya cumplen los 5, pasar a PENDING_PAYMENT y notificar al gestor
    if (availableCount >= 5) {
      return prisma.$transaction(async (tx) => {
        const updated = await tx.tournamentEnrollment.update({
          where: { id: enrollmentId },
          data: { 
            status: "PENDING_PAYMENT",
            availabilityNote: null
          },
        });

        // Notificar al gestor que el equipo ya está listo para aprobarse
        await notificationEngine.create(tx, {
          userId: enrollment.tournament.manager.profile.userId,
          family: "TOURNAMENT",
          type: "ENROLLMENT_SUBMITTED", 
          title: "Inscripción Reevaluada (Lista para Pago)",
          body: `Un equipo ha actualizado su disponibilidad y ya cumple con los 5 jugadores para ${enrollment.tournament.name}.`,
          payload: { tournamentId: enrollment.tournamentId, enrollmentId: enrollment.id, teamId: enrollment.teamId }
        });

        return updated;
      });
    }

    // Si aún no cumplen, lanzamos error para avisarle al capitán
    throw new TRPCError({ 
      code: "BAD_REQUEST", 
      message: `Aún no hay 5 jugadores disponibles. (Actual: ${availableCount})` 
    });
  }
};