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

      // Crear la membresía del creador como Capitán
      await tx.teamMembership.create({
        data: {
          playerId: profile.player.id,
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

      // 4. Si era el último capitán pero quedan miembros (caso borde no cubierto arriba por alguna razón)
      // El equipo se queda sin capitán, pero mantenemos ACTIVE para que puedan reclamar capitanía luego.
      // Esto está cubierto por el throw de arriba, pero lo dejamos como nota de seguridad.

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

  async requestDelete(prisma: PrismaClient, teamId: string, userId: string) {
    const captainMship = await this.assertTeamCaptain(prisma, teamId, userId);

    // 1. Contar miembros activos
    const activeMembersCount = await prisma.teamMembership.count({
      where: { teamId, leftAt: null },
    });

    // 2. Si es < 3, eliminación directa (Soft Delete: Status INACTIVE)
    if (activeMembersCount < 3) {
      return prisma.$transaction(async (tx) => {
        await tx.teamMembership.updateMany({
          where: { teamId, leftAt: null },
          data: { leftAt: new Date() },
        });
        await tx.team.update({
          where: { id: teamId },
          data: { status: "INACTIVE" },
        });
        return { directDelete: true, message: "Equipo eliminado correctamente" };
      });
    }

    // 3. Si es >= 3, verificar que no haya una solicitud pendiente ya
    const existingRequest = await prisma.teamDeletionRequest.findUnique({
      where: { teamId },
    });

    if (existingRequest && existingRequest.status === "PENDING") {
      throw new TRPCError({ code: "CONFLICT", message: "Ya hay una solicitud de eliminación pendiente" });
    }

    // 4. Crear solicitud de eliminación
    await prisma.teamDeletionRequest.create({
      data: {
        teamId,
        requestedBy: captainMship.playerId,
        status: "PENDING",
      },
    });

    return { directDelete: false, message: "Solicitud de eliminación creada. Se requiere votación de la plantilla." };
  },

  async voteDeletion(prisma: PrismaClient, teamId: string, userId: string, approve: boolean) {
    const profile = await prisma.profile.findUnique({
      where: { userId },
      include: { player: true },
    });
    if (!profile?.player) throw new TRPCError({ code: "NOT_FOUND", message: "Perfil no encontrado" });

    const membership = await prisma.teamMembership.findFirst({
      where: { teamId, playerId: profile.player.id, leftAt: null },
    });
    if (!membership) throw new TRPCError({ code: "FORBIDDEN", message: "No eres miembro de este equipo" });

    const request = await prisma.teamDeletionRequest.findUnique({
      where: { teamId },
      include: { votes: true },
    });

    if (!request || request.status !== "PENDING") {
      throw new TRPCError({ code: "NOT_FOUND", message: "No hay solicitud de eliminación pendiente" });
    }

    // 1. Verificar si ya votó
    const hasVoted = request.votes.some(v => v.playerId === profile.player!.id);
    if (hasVoted) throw new TRPCError({ code: "CONFLICT", message: "Ya has emitido tu voto" });

    return prisma.$transaction(async (tx) => {
      // 2. Registrar voto
      await tx.teamDeletionVote.create({
        data: {
          requestId: request.id,
          playerId: profile.player!.id,
          approve,
        },
      });

      // 3. Si el voto es NO, se cancela la solicitud automáticamente
      if (!approve) {
        await tx.teamDeletionRequest.update({
          where: { id: request.id },
          data: { status: "CANCELLED" },
        });
        return { deleted: false, message: "Voto registrado. Solicitud cancelada por rechazo." };
      }

      // 4. Si el voto es SÍ, verificar si todos los miembros activos han votado que SÍ
      const activeMembers = await tx.teamMembership.count({
        where: { teamId, leftAt: null },
      });

      const yesVotes = await tx.teamDeletionVote.count({
        where: { requestId: request.id, approve: true },
      });

      // Si la cantidad de votos afirmativos equivale a la cantidad de miembros activos -> Consenso alcanzado
      if (yesVotes >= activeMembers) {
        await tx.teamMembership.updateMany({
          where: { teamId, leftAt: null },
          data: { leftAt: new Date() },
        });
        await tx.team.update({
          where: { id: teamId },
          data: { status: "INACTIVE" },
        });
        await tx.teamDeletionRequest.update({
          where: { id: request.id },
          data: { status: "APPROVED" },
        });
        return { deleted: true, message: "Consenso alcanzado. Equipo eliminado." };
      }

      return { deleted: false, message: "Voto registrado. Faltan votos para alcanzar consenso." };
    });
  },

  async cancelDeletionRequest(prisma: PrismaClient, teamId: string, userId: string) {
    await this.assertTeamCaptain(prisma, teamId, userId);
    
    const request = await prisma.teamDeletionRequest.findUnique({ where: { teamId } });
    if (!request || request.status !== "PENDING") {
      throw new TRPCError({ code: "NOT_FOUND", message: "No hay solicitud pendiente para cancelar" });
    }

    await prisma.teamDeletionRequest.update({
      where: { id: request.id },
      data: { status: "CANCELLED" },
    });

    return { success: true };
  },
};