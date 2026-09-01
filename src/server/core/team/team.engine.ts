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

    const isCaptainElsewhere = await prisma.teamMembership.findFirst({
      where: {
        player: { profile: { userId } },
        isCaptain: true,
        leftAt: null,
      },
    });
    if (isCaptainElsewhere)
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Ya eres capitán de otro equipo activo",
      });

    return prisma.team.create({ data: { ...input, status: "DRAFT" } });
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

      if (!invitation.teamId) {
        // Buscamos el borrador creado por el invitador
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

        await tx.teamMembership.create({
          data: {
            playerId: invitation.invitedBy,
            teamId: draftTeam.id,
            isCaptain: true,
          },
        });
        await tx.teamMembership.create({
          data: {
            playerId: invitation.playerId,
            teamId: draftTeam.id,
            isCaptain: false,
          },
        });
        await tx.team.update({
          where: { id: draftTeam.id },
          data: { status: "ACTIVE" },
        });

        const captainRole = await tx.role.findUnique({
          where: { name: "captain" },
        });
        if (captainRole) {
          await tx.roleAssignment.create({
            data: {
              profileId: invitation.invitedBy,
              roleId: captainRole.id,
            },
          });
        }
      } else {
        await tx.teamMembership.create({
          data: {
            playerId: invitation.playerId,
            teamId: invitation.teamId,
            isCaptain: false,
          },
        });
      }
    });
  },
};