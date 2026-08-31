import type { PrismaClient } from "@prisma/client";

export const availabilityEngine = {
  async getByPlayerId(prisma: PrismaClient, playerId: string) {
    return prisma.playerAvailability.findMany({
      where: { playerId },
    });
  },

  async toggleSlot(prisma: PrismaClient, playerId: string, dayOfWeek: number, timeSlot: number) {
    const existing = await prisma.playerAvailability.findUnique({
      where: { playerId_dayOfWeek_timeSlot: { playerId, dayOfWeek, timeSlot } },
    });

    if (!existing) throw new Error("Slot no existe");

    return prisma.playerAvailability.update({
      where: { id: existing.id },
      data: {
        status: existing.status === "AVAILABLE" ? "UNAVAILABLE" : "AVAILABLE",
      },
    });
  },
};