import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";

export const teamEngine = {
  async createDraft(
    prisma: PrismaClient,
    input: {
      name: string;
      abbreviation: string;
      primaryColor: string;
      secondaryColor?: string;
      description?: string;
    },
    userId: string
  ) {
    // 1. Validar que el nombre y abreviatura no existan
    const exists = await prisma.team.findFirst({
      where: {
        OR: [
          { name: { equals: input.name, mode: "insensitive" } },
          { abbreviation: { equals: input.abbreviation, mode: "insensitive" } },
        ],
      },
    });
    if (exists)
      throw new TRPCError({
        code: "CONFLICT",
        message: "Nombre o abreviatura ya existe",
      });

    // 2. Buscar el perfil del creador
    const profile = await prisma.profile.findUnique({
      where: { userId },
      include: { player: true },
    });
    if (!profile?.player)
      throw new TRPCError({ code: "NOT_FOUND", message: "Tu perfil de jugador no existe" });

    // 3. Validar que no sea capitán de otro equipo activo
    const isCaptainElsewhere = await prisma.teamMembership.findFirst({
      where: {
        playerId: profile.player.id,
        isCaptain: true,
        leftAt: null,
      },
    });
    if (isCaptainElsewhere)
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Ya eres capitán de otro equipo activo",
      });

    // 4. Transacción: Crear equipo, membresía de capitán y asignar rol
    return prisma.$transaction(async (tx) => {
      const newTeam = await tx.team.create({ data: { ...input, status: "DRAFT" } });

      // Solución error TS18047: Usamos la constante validada profile.player.id
      const playerId = profile.player.id;

      // Crear la membresía del creador como Capitán
      await tx.teamMembership.create({
        data: {
          playerId,
          teamId: newTeam.id,
          isCaptain: true,
        },
      });

      // Asignar el rol de Capitán en la BD para permisos tRPC
      const captainRole = await tx.role.findUnique({ where: { name: "captain" } });
      if (captainRole) {
        const existingAssignment = await tx.roleAssignment.findUnique({
          where: { profileId_roleId: { profileId: profile.id, roleId: captainRole.id } }
        });
        if (!existingAssignment) {
          await tx.roleAssignment.create({
            data: { profileId: profile.id, roleId: captainRole.id },
          });
        }
      }

      return newTeam;
    });
  },

  async invitePlayer(
    prisma: PrismaClient,
    input: { teamId?: string; playerId: string },
    inviterUserId: string
  ) {
    const inviterProfile = await prisma.profile.findUnique({
      where: { userId: inviterUserId },
      include: { player: true },
    });
    if (!inviterProfile?.player)
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Invitador no es jugador",
      });

    if (input.teamId) {
      const membership = await prisma.teamMembership.findFirst({
        where: {
          teamId: input.teamId,
          playerId: inviterProfile.player.id,
          isCaptain: true,
          leftAt: null,
        },
      });
      if (!membership)
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Solo el capitán puede invitar",
        });

      // Validar que no invita a alguien que ya es miembro
      const isAlreadyMember = await prisma.teamMembership.findFirst({
        where: { teamId: input.teamId, playerId: input.playerId, leftAt: null },
      });
      if (isAlreadyMember)
        throw new TRPCError({ code: "CONFLICT", message: "El jugador ya es miembro de este equipo" });
    }

    const existingPending = await prisma.teamInvitation.findFirst({
      where: { playerId: input.playerId, status: "PENDING", teamId: input.teamId },
    });
    if (existingPending)
      throw new TRPCError({
        code: "CONFLICT",
        message: "Ya tiene invitación pendiente",
      });

    return prisma.teamInvitation.create({
      data: {
        teamId: input.teamId,
        playerId: input.playerId,
        invitedBy: inviterProfile.player.id,
        status: "PENDING",
      },
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
    if (!profile?.player)
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Perfil no encontrado",
      });

    const invitation = await prisma.teamInvitation.findUnique({
      where: { id: invitationId },
      include: { team: true },
    });

    if (!invitation?.playerId || invitation.playerId !== profile.player.id) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Invitación no válida" });
    }
    if (invitation.status !== "PENDING") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Invitación ya procesada",
      });
    }

    return prisma.$transaction(async (tx) => {
      await tx.teamInvitation.update({
        where: { id: invitationId },
        data: { status: "ACCEPTED", respondedAt: new Date() },
      });

      let teamId = invitation.teamId;

      // Si la invitación no tiene teamId, significa que fue para un equipo DRAFT recién creado
      if (!teamId) {
        const draftTeam = await tx.team.findFirst({
          where: {
            status: "DRAFT",
            memberships: {
              some: {
                playerId: invitation.invitedBy,
                isCaptain: true,
              },
            },
          },
        });

        if (!draftTeam)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Equipo en borrador no encontrado",
          });

        teamId = draftTeam.id;

        // El equipo pasa a estar activo
        await tx.team.update({
          where: { id: teamId },
          data: { status: "ACTIVE" },
        });
      }

      // Creamos la membresía del jugador que acaba de aceptar
      await tx.teamMembership.create({
        data: {
          playerId: invitation.playerId,
          teamId: teamId,
          isCaptain: false,
        },
      });
    });
  },

  async leaveTeam(prisma: PrismaClient, teamId: string, userId: string) {
    const profile = await prisma.profile.findUnique({
      where: { userId },
      include: { player: true },
    });

    if (!profile?.player) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Perfil de jugador no encontrado" });
    }

    const membership = await prisma.teamMembership.findFirst({
      where: {
        teamId,
        playerId: profile.player.id,
        leftAt: null,
      },
    });

    if (!membership) {
      throw new TRPCError({ code: "NOT_FOUND", message: "No eres miembro de este equipo" });
    }

    // Validación: Si es capitán y hay otros miembros, no puede abandonar directamente
    if (membership.isCaptain) {
      const otherMembersCount = await prisma.teamMembership.count({
        where: { teamId, leftAt: null, playerId: { not: profile.player.id } }
      });

      if (otherMembersCount > 0) {
        throw new TRPCError({ 
          code: "FORBIDDEN", 
          message: "Debes transferir la capitanía o eliminar el equipo antes de abandonarlo." 
        });
      }
    }

    // Transacción: Abandonar y evaluar estado del equipo
    return prisma.$transaction(async (tx) => {
      // 1. Marcar la membresía como abandonada
      await tx.teamMembership.update({
        where: { id: membership.id },
        data: { leftAt: new Date() },
      });

      // 2. Contar miembros restantes
      const remainingMembers = await tx.teamMembership.count({
        where: { teamId, leftAt: null },
      });

      // 3. Si quedan 0 miembros, el equipo pasa a INACTIVE
      if (remainingMembers === 0) {
        await tx.team.update({
          where: { id: teamId },
          data: { status: "INACTIVE" },
        });
      }

      return { success: true, remainingMembers };
    });
  },

  // Helper local para validar capitanía
  async assertTeamCaptain(prisma: PrismaClient, teamId: string, userId: string) {
    const membership = await prisma.teamMembership.findFirst({
      where: { teamId, isCaptain: true, leftAt: null, player: { profile: { userId } } },
    });
    if (!membership) throw new TRPCError({ code: "FORBIDDEN", message: "Solo el capitán puede realizar esta acción" });
    return membership;
  },

  // ==========================================
  // Eliminación de Equipo (Sistema 3)
  // ==========================================
  async requestDelete(prisma: PrismaClient, teamId: string, userId: string) {
    // 1. Validar que es capitán
    const membership = await prisma.teamMembership.findFirst({
      where: { 
        teamId, 
        isCaptain: true, 
        leftAt: null, 
        player: { profile: { userId } } 
      },
      include: { team: true }
    });

    if (!membership) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Solo el capitán puede solicitar la eliminación" });
    }

    if (membership.team.status === "INACTIVE") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "El equipo ya está inactivo" });
    }

    // 2. Contar miembros activos
    const activeMembersCount = await prisma.teamMembership.count({
      where: { teamId, leftAt: null }
    });

    // 3. Si es < 3, eliminación directa (Soft Delete: pasa a INACTIVE)
    if (activeMembersCount < 3) {
      await prisma.$transaction(async (tx) => {
        await tx.team.update({
          where: { id: teamId },
          data: { status: "INACTIVE" }
        });
        // Marcar membresías como abandonadas para limpiar la plantilla
        await tx.teamMembership.updateMany({
          where: { teamId, leftAt: null },
          data: { leftAt: new Date() }
        });
      });
      return { directDelete: true };
    }

    // 4. Si es >= 3, crear solicitud de votación
    const existingRequest = await prisma.teamDeletionRequest.findFirst({
      where: { teamId, status: "PENDING" }
    });
    if (existingRequest) {
      throw new TRPCError({ code: "CONFLICT", message: "Ya hay una solicitud de eliminación pendiente" });
    }

    const request = await prisma.teamDeletionRequest.create({
      data: {
        teamId,
        requestedBy: membership.playerId,
        status: "PENDING"
      }
    });

    // El capitán que la solicita vota automáticamente a favor (Corregido: playerId y approve)
    await prisma.teamDeletionVote.create({
      data: {
        requestId: request.id,
        playerId: membership.playerId,
        approve: true
      }
    });

    return { directDelete: false, requestId: request.id };
  },

  async confirmDelete(prisma: PrismaClient, requestId: string, approve: boolean, userId: string) {
    const profile = await prisma.profile.findUnique({
      where: { userId },
      include: { player: true }
    });
    if (!profile?.player) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Perfil no encontrado" });
    }

    const request = await prisma.teamDeletionRequest.findUnique({
      where: { id: requestId },
      include: { team: true }
    });

    // Solución ESLint: Optional chaining request?.status
    if (!request || request.status !== "PENDING") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Solicitud no encontrada o ya procesada" });
    }

    // Validar que el votante es miembro activo del equipo
    const membership = await prisma.teamMembership.findFirst({
      where: { teamId: request.teamId, playerId: profile.player.id, leftAt: null }
    });
    if (!membership) {
      throw new TRPCError({ code: "FORBIDDEN", message: "No eres miembro de este equipo" });
    }

    // Upsert del voto (Corregido: requestId_playerId, playerId y approve)
    await prisma.teamDeletionVote.upsert({
      where: { requestId_playerId: { requestId, playerId: membership.playerId } },
      update: { approve },
      create: { requestId, playerId: membership.playerId, approve }
    });

    // Si rechaza, la solicitud se deniega
    if (!approve) {
      await prisma.teamDeletionRequest.update({
        where: { id: requestId },
        data: { status: "CANCELLED" }
      });
      return { finalized: true, approved: false };
    }

    // Contar votos a favor y total de miembros (Corregido: approve)
    const approveVotes = await prisma.teamDeletionVote.count({
      where: { requestId, approve: true }
    });
    const totalMembers = await prisma.teamMembership.count({
      where: { teamId: request.teamId, leftAt: null }
    });

    // Si hay consenso unánime, ejecutar eliminación (Soft delete)
    if (approveVotes >= totalMembers) {
      await prisma.$transaction(async (tx) => {
        await tx.team.update({
          where: { id: request.teamId },
          data: { status: "INACTIVE" }
        });
        await tx.teamMembership.updateMany({
          where: { teamId: request.teamId, leftAt: null },
          data: { leftAt: new Date() }
        });
        await tx.teamDeletionRequest.update({
          where: { id: requestId },
          data: { status: "EXECUTED" }
        });
      });
      return { finalized: true, approved: true };
    }

    return { finalized: false, votes: approveVotes, total: totalMembers };
  },
};