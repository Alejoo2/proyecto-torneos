// src/server/core/recruitment/recruitment.engine.ts

import { AvailabilityStatus, InvitationStatus, type PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { notificationEngine } from "../notification/notification.engine";

// Helper interno para validar que el usuario es capitán del equipo
async function assertActiveCaptain(prisma: PrismaClient, teamId: string, userId: string) {
  const membership = await prisma.teamMembership.findFirst({
    where: {
      teamId,
      isCaptain: true,
      leftAt: null,
      player: { profile: { userId } },
    },
    include: { team: true },
  });

  if (!membership) {
    throw new TRPCError({ code: "FORBIDDEN", message: "No eres capitán de este equipo" });
  }
  // 👇 PERMITIMOS DRAFT Y ACTIVE 👇
  if (membership.team.status !== "ACTIVE" && membership.team.status !== "DRAFT") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "El equipo no está activo para reclutar" });
  }
  return membership;
}

// Helper para validar límites de saturación
async function assertTeamNotSaturated(prisma: PrismaClient, teamId: string) {
  const count = await prisma.teamMembership.count({
    where: { teamId, leftAt: null },
  });
  if (count >= 15) {
    throw new TRPCError({ code: "FORBIDDEN", message: "El equipo ya tiene 15 miembros" });
  }
}

export const recruitmentEngine = {
  // ==========================================
  // 1. Descubrimiento: Buscador de jugadores
  // ==========================================
  async searchPlayers(
    prisma: PrismaClient,
    input: {
      teamId: string;
      query?: string;
      availabilityFilter?: { dayOfWeek?: number; timeSlot?: number };
      page?: number;
      pageSize?: number;
    },
    userId: string
  ) {
    // 1. Verificar capitanía y equipo activo
    await assertActiveCaptain(prisma, input.teamId, userId);
    
    // 2. Verificar que el equipo no está saturado
    await assertTeamNotSaturated(prisma, input.teamId);

    // 3. Construir filtros dinámicos de Prisma
    const whereClause = {
      // Excluir miembros actuales del equipo
      teamMemberships: { none: { teamId: input.teamId, leftAt: null } },
      // Excluir jugadores con invitación PENDING para este equipo
      invitations: { none: { teamId: input.teamId, status: InvitationStatus.PENDING } },
      // Filtro por nombre (insensitive)
      profile: {
        displayName: input.query
          ? { contains: input.query, mode: "insensitive" as const }
          : undefined,
      },
      // Filtro por disponibilidad horaria
      availabilities: input.availabilityFilter?.dayOfWeek !== undefined && input.availabilityFilter?.timeSlot !== undefined
        ? {
            some: {
              dayOfWeek: input.availabilityFilter.dayOfWeek,
              timeSlot: input.availabilityFilter.timeSlot,
              status: AvailabilityStatus.AVAILABLE,
            },
          }
        : undefined,
    };

    const pageSize = input.pageSize ?? 20;
    const page = input.page ?? 1;

    const players = await prisma.player.findMany({
      where: whereClause,
      include: {
        profile: { include: { user: { select: { image: true } } } },
        availabilities: {
          where: { status: AvailabilityStatus.AVAILABLE },
          select: { dayOfWeek: true, timeSlot: true },
        },
        _count: {
          select: { teamMemberships: { where: { leftAt: null } } },
        },
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    // 4. Filtrar post-query: Excluir jugadores saturados (>= 15 equipos)
    return players.filter((p) => p._count.teamMemberships < 15);
  },

  // ==========================================
  // 2. Invitación: Enviar y Revocar
  // ==========================================
  async invite(
    prisma: PrismaClient,
    input: { teamId: string; playerId: string },
    userId: string
  ) {
    await assertActiveCaptain(prisma, input.teamId, userId);
    await assertTeamNotSaturated(prisma, input.teamId);

    const playerTeamsCount = await prisma.teamMembership.count({
      where: { playerId: input.playerId, leftAt: null },
    });
    if (playerTeamsCount >= 15) {
      throw new TRPCError({ code: "FORBIDDEN", message: "El jugador ya pertenece a 15 equipos" });
    }

    const existingPending = await prisma.teamInvitation.findFirst({
      where: { teamId: input.teamId, playerId: input.playerId, status: "PENDING" },
    });
    if (existingPending) {
      throw new TRPCError({ code: "CONFLICT", message: "Ya tiene una invitación pendiente" });
    }

    const recentRejected = await prisma.teamInvitation.findFirst({
      where: {
        teamId: input.teamId, playerId: input.playerId, status: "REJECTED",
        respondedAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });
    if (recentRejected) {
      throw new TRPCError({ code: "CONFLICT", message: "Debe esperar 24 horas para reinvitar a este jugador" });
    }

    const inviterProfile = await prisma.profile.findUnique({
      where: { userId },
      include: { player: true },
    });
    if (!inviterProfile?.player) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Tu perfil de jugador no existe" });
    }
    const inviterPlayerId = inviterProfile.player.id;

    // NUEVO: Transacción atómica con notificación
    return prisma.$transaction(async (tx) => {
      const invitation = await tx.teamInvitation.create({
        data: {
          teamId: input.teamId,
          playerId: input.playerId,
          invitedBy: inviterPlayerId,
          status: "PENDING",
        },
      });

      const recipient = await tx.player.findUnique({
        where: { id: input.playerId },
        select: { profile: { select: { userId: true } } },
      });

      if (recipient?.profile.userId) {
        await notificationEngine.create(tx, {
          userId: recipient.profile.userId,
          family: "RECRUITMENT",
          type: "RECRUITMENT_REQUEST_SENT",
          title: "Nueva respuesta de reclutamiento",
          body: `${inviterProfile.displayName ?? "Un capitán"} te ha invitado a unirte a su equipo`,
          payload: { teamId: input.teamId, invitationId: invitation.id },
        });
      }

      return invitation;
    });
  },

  async revokeInvitation(
    prisma: PrismaClient,
    invitationId: string,
    userId: string
  ) {
    const invitation = await prisma.teamInvitation.findUnique({
      where: { id: invitationId },
      include: { team: true },
    });

    if (!invitation) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Invitación no encontrada" });
    }
    if (invitation.status !== "PENDING") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "La invitación ya fue procesada" });
    }
    if (!invitation.teamId) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Invitación inválida" });
    }

    // Validar que el que revoca es el capitán del equipo emisor
    await assertActiveCaptain(prisma, invitation.teamId, userId);

    const updated = await prisma.teamInvitation.update({
      where: { id: invitationId },
      data: { status: "REVOKED", respondedAt: new Date() },
    });

    // TODO: Sistema 11 - Emitir notificación al jugador de que su invitación fue revocada

    return updated;
  },

  // ==========================================
  // 3. Jugador Pasivo: Aceptar y Rechazar
  // ==========================================
  async getPendingForPlayer(prisma: PrismaClient, userId: string) {
    const profile = await prisma.profile.findUnique({
      where: { userId },
      include: { player: true },
    });
    if (!profile?.player) return [];
    const playerId = profile.player.id;

    return prisma.teamInvitation.findMany({
      where: {
        playerId,
        status: "PENDING",
      },
      include: {
        team: { select: { id: true, name: true, primaryColor: true, secondaryColor: true } },
        inviter: { include: { profile: { select: { displayName: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  async acceptInvitation(
    prisma: PrismaClient,
    invitationId: string,
    userId: string
  ) {
    const profile = await prisma.profile.findUnique({
      where: { userId },
      include: { player: true },
    });
    if (!profile?.player) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Perfil de jugador no encontrado" });
    }

    const invitation = await prisma.teamInvitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation?.playerId || invitation.playerId !== profile.player.id) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Esta invitación no es para ti" });
    }
    if (invitation.status !== "PENDING") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "La invitación ya fue procesada" });
    }
    if (!invitation.teamId) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Invitación no vinculada a un equipo activo" });
    }

    const targetTeamId = invitation.teamId;

    return prisma.$transaction(async (tx) => {
      // 1. Marcar invitación como aceptada
      await tx.teamInvitation.update({
        where: { id: invitationId },
        data: { status: "ACCEPTED", respondedAt: new Date() },
      });

      // 2. Crear membresía
      await tx.teamMembership.create({
        data: {
          playerId: invitation.playerId,
          teamId: targetTeamId,
          isCaptain: false,
        },
      });

      // 3. Lógica de Saturación: ¿El equipo llegó a 15?
      const activeMembersCount = await tx.teamMembership.count({
        where: { teamId: targetTeamId, leftAt: null },
      });

      if (activeMembersCount >= 15) {
        // Rechazar automáticamente todas las otras PENDING de este equipo
        await tx.teamInvitation.updateMany({
          where: {
            teamId: targetTeamId,
            status: "PENDING",
            id: { not: invitationId },
          },
          data: { status: "REJECTED", respondedAt: new Date() },
        });
        
        // TODO: Sistema 11 - Emitir notificación masiva a los jugadores rechazados por saturación
      }

      // TODO: Sistema 11 - Emitir notificación al capitán de que el jugador aceptó

      return { success: true, teamId: targetTeamId };
    });
  },

  async rejectInvitation(
    prisma: PrismaClient,
    invitationId: string,
    userId: string
  ) {
    const profile = await prisma.profile.findUnique({
      where: { userId },
      include: { player: true },
    });
    if (!profile?.player) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Perfil de jugador no encontrado" });
    }

    const invitation = await prisma.teamInvitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation?.playerId || invitation.playerId !== profile.player.id) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Esta invitación no es para ti" });
    }
    if (invitation.status !== "PENDING") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "La invitación ya fue procesada" });
    }

    const updated = await prisma.teamInvitation.update({
      where: { id: invitationId },
      data: { status: "REJECTED", respondedAt: new Date() },
    });

    // TODO: Sistema 11 - Emitir notificación al capitán de que el jugador rechazó

    return updated;
  },
    // ==========================================
  // 4. Perfil Público de Jugador (para Capitanes)
  // ==========================================
  async getPlayerProfile(
    prisma: PrismaClient,
    input: { teamId: string; playerId: string },
    userId: string
  ) {
    // 1. Validar que quien pide la info es capitán de un equipo activo/draft
    await assertActiveCaptain(prisma, input.teamId, userId);

    // 2. Obtener el jugador con su perfil y disponibilidades
    const player = await prisma.player.findUnique({
      where: { id: input.playerId },
      include: {
        profile: { 
          include: { user: { select: { image: true } } } 
        },
        availabilities: {
          select: { dayOfWeek: true, timeSlot: true, status: true }
        },
        _count: {
          select: { teamMemberships: { where: { leftAt: null } } }
        }
      },
    });

    if (!player) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Jugador no encontrado" });
    }

    return player;
  },
};