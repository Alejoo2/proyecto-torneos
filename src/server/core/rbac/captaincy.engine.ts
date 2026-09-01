import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";

export const captaincyEngine = {
    async requestTransfer(prisma: PrismaClient, input: { teamId: string; toPlayerId: string }, userId: string) {
    const fromProfile = await prisma.profile.findUnique({
      where: { userId },
      include: { player: { include: { teamMemberships: { where: { leftAt: null, isCaptain: true } } } } },
    });

    if (!fromProfile?.player) throw new TRPCError({ code: "NOT_FOUND", message: "No eres jugador" });
    
    const captainMembership = fromProfile.player.teamMemberships.find(tm => tm.teamId === input.teamId);
    if (!captainMembership) throw new TRPCError({ code: "FORBIDDEN", message: "No eres capitán de este equipo" });

    const toMembership = await prisma.teamMembership.findFirst({
      where: { teamId: input.teamId, playerId: input.toPlayerId, leftAt: null }
    });
    if (!toMembership) throw new TRPCError({ code: "NOT_FOUND", message: "El receptor no es miembro activo" });

    const isCaptainElsewhere = await prisma.teamMembership.findFirst({
      where: { 
        playerId: input.toPlayerId, 
        isCaptain: true, 
        leftAt: null, 
        NOT: { teamId: input.teamId } 
      }
    });
    if (isCaptainElsewhere) throw new TRPCError({ code: "CONFLICT", message: "El receptor ya es capitán de otro equipo" });

    const existingTransfer = await prisma.captaincyTransfer.findFirst({
      where: { fromId: captainMembership.id, status: "PENDING" }
    });
    if (existingTransfer) throw new TRPCError({ code: "CONFLICT", message: "Ya tienes una transferencia pendiente" });

    // Creamos la transferencia pasando el teamId y conectando los miembros
    return prisma.captaincyTransfer.create({
      data: {
        teamId: input.teamId,
        fromId: captainMembership.id,
        toId: toMembership.id,
        status: "PENDING"
      }
    });
  },

  async acceptTransfer(prisma: PrismaClient, transferId: string, userId: string) {
    const toProfile = await prisma.profile.findUnique({
      where: { userId },
      include: { player: true },
    });
    if (!toProfile?.player) throw new TRPCError({ code: "NOT_FOUND", message: "Perfil no encontrado" });

    const transferRecord = await prisma.captaincyTransfer.findUnique({
      where: { id: transferId },
      include: { to: true, from: true }
    });

    if (!transferRecord) throw new TRPCError({ code: "NOT_FOUND", message: "Transferencia no encontrada" });
    if (transferRecord.to.playerId !== toProfile.player.id) throw new TRPCError({ code: "FORBIDDEN", message: "Esta transferencia no es para ti" });
    if (transferRecord.status !== "PENDING") throw new TRPCError({ code: "BAD_REQUEST", message: "Ya fue procesada" });

    return prisma.$transaction(async (tx) => {
      await tx.teamMembership.update({
        where: { id: transferRecord.fromId },
        data: { isCaptain: false }
      });
      
      await tx.teamMembership.update({
        where: { id: transferRecord.toId },
        data: { isCaptain: true }
      });

      return tx.captaincyTransfer.update({
        where: { id: transferId },
        data: { status: "ACCEPTED", respondedAt: new Date() }
      });
    });
  },

  async rejectTransfer(prisma: PrismaClient, transferId: string, userId: string) {
    const toProfile = await prisma.profile.findUnique({
      where: { userId },
      include: { player: true },
    });
    if (!toProfile?.player) throw new TRPCError({ code: "NOT_FOUND", message: "Perfil no encontrado" });

    const transferRecord = await prisma.captaincyTransfer.findUnique({
      where: { id: transferId },
      include: { to: true }
    });

    if (!transferRecord) throw new TRPCError({ code: "NOT_FOUND", message: "Transferencia no encontrada" });
    if (transferRecord.to.playerId !== toProfile.player.id) throw new TRPCError({ code: "FORBIDDEN", message: "Esta transferencia no es para ti" });
    if (transferRecord.status !== "PENDING") throw new TRPCError({ code: "BAD_REQUEST", message: "Ya fue procesada" });

    return prisma.captaincyTransfer.update({
      where: { id: transferId },
      data: { status: "REJECTED", respondedAt: new Date() }
    });
  },

  async getPendingForPlayer(prisma: PrismaClient, userId: string) {
    const profile = await prisma.profile.findUnique({
      where: { userId },
      include: { player: true },
    });
    if (!profile?.player) return [];

    return prisma.captaincyTransfer.findMany({
      where: {
        status: "PENDING",
        to: { playerId: profile.player.id }
      },
      include: {
        from: { include: { team: true, player: { include: { profile: true } } } }
      }
    });
  }
};