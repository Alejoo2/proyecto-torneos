// src/server/core/recruitment/recruitment.engine.ts

import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";

// Helper interno para validar que el usuario es capitán del equipo y el equipo está activo
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
  if (membership.team.status !== "ACTIVE") {
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
      invitations: { none: { teamId: input.teamId, status: "PENDING" } },
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
              status: "AVAILABLE",
            },
          }
        : undefined,
    };

    const players = await prisma.player.findMany({
      where: whereClause,
      include: {
        profile: { include: { user: { select: { image: true } } } },
        availabilities: {
          where: { status: "AVAILABLE" },
          select: { dayOfWeek: true, timeSlot: true },
        },
        _count: {
          select: { teamMemberships: { where: { leftAt: null } } },
        },
      },
      skip: ((input.page || 1) - 1) * (input.pageSize || 20),
      take: input.pageSize || 20,
    });

    // 4. Filtrar post-query: Excluir jugadores saturados (>= 15 equipos)
    // Hacemos esto en memoria porque Prisma no soporta _count > X en el where nativo sin raw queries.
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
    // 1. Validaciones de Capitán y Equipo
    await assertActiveCaptain(prisma, input.teamId, userId);
    await assertTeamNotSaturated(prisma, input.teamId);

    // 2. Validar límites del jugador receptor
    const playerTeamsCount = await prisma.teamMembership.count({
      where: { playerId: input.playerId, leftAt: null },
    });
    if (playerTeamsCount >= 15) {
      throw new TRPCError({ code: "FORBIDDEN", message: "El jugador ya pertenece a 15 equipos" });
    }

    // 3. Validar que no exista una invitación PENDING previa
    const existingPending = await prisma.teamInvitation.findFirst({
      where: { teamId: input.teamId, playerId: input.playerId, status: "PENDING" },
    });
    if (existingPending) {
      throw new TRPCError({ code: "CONFLICT", message: "Ya tiene una invitación pendiente" });
    }

    // 4. Validar Cooldown de 24h post-rechazo
    const recentRejected = await prisma.teamInvitation.findFirst({
      where: {
        teamId: input.teamId,
        playerId: input.playerId,
        status: "REJECTED",
        respondedAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });
    if (recentRejected) {
      throw new TRPCError({ code: "CONFLICT", message: "Debe esperar 24 horas para reinvitar a este jugador" });
    }

    // 5. Obtener ID del invitador (Capitán)
    const inviterProfile = await prisma.profile.findUnique({
      where: { userId },
      include: { player: true },
    });

    if (!inviterProfile?.player) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Tu perfil de jugador no existe" });
    }

    // 6. Crear invitación
    const invitation = await prisma.teamInvitation.create({
      data: {
        teamId: input.teamId,
        playerId: input.playerId,
        invitedBy: inviterProfile.player.id,
        status: "PENDING",
      },
    });

    // TODO: Sistema 11 - Emitir notificación de nueva invitación al jugador

    return invitation;
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

    return prisma.teamInvitation.findMany({
      where: {
        playerId: profile.player.id,
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

    if (!invitation || invitation.playerId !== profile.player.id) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Esta invitación no es para ti" });
    }
    if (invitation.status !== "PENDING") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "La invitación ya fue procesada" });
    }
    if (!invitation.teamId) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Invitación no vinculada a un equipo activo" });
    }

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
          teamId: invitation.teamId,
          isCaptain: false,
        },
      });

      // 3. Lógica de Saturación: ¿El equipo llegó a 15?
      const activeMembersCount = await tx.teamMembership.count({
        where: { teamId: invitation.teamId, leftAt: null },
      });

      if (activeMembersCount >= 15) {
        // Rechazar automáticamente todas las otras PENDING de este equipo
        await tx.teamInvitation.updateMany({
          where: {
            teamId: invitation.teamId,
            status: "PENDING",
            id: { not: invitationId },
          },
          data: { status: "REJECTED", respondedAt: new Date() },
        });
        
        // TODO: Sistema 11 - Emitir notificación masiva a los jugadores rechazados por saturación
      }

      // TODO: Sistema 11 - Emitir notificación al capitán de que el jugador aceptó

      return { success: true, teamId: invitation.teamId };
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

    if (!invitation || invitation.playerId !== profile.player.id) {
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
};