import type { PrismaClient } from "@prisma/client";

export const availabilityEngine = {
  async getByPlayerId(prisma: PrismaClient, playerId: string) {
    return prisma.playerAvailability.findMany({
      where: { playerId },
    });
  },

  async toggleSlot(prisma: PrismaClient, playerId: string, dayOfWeek: number, timeSlot: number) {
    // 👇 Buscamos si existe
    const existing = await prisma.playerAvailability.findUnique({
      where: { playerId_dayOfWeek_timeSlot: { playerId, dayOfWeek, timeSlot } },
    });

    // 👇 Si no existe, la creamos como AVAILABLE (o UNAVAILABLE si ese fuera el caso)
    // Esto repara los usuarios antiguos que no tuvieron el seed automático
    if (!existing) {
      return prisma.playerAvailability.create({
        data: {
          playerId,
          dayOfWeek,
          timeSlot,
          status: "AVAILABLE",
        },
      });
    }

    // 👇 Si existe, hacemos el toggle normal
    return prisma.playerAvailability.update({
      where: { id: existing.id },
      data: {
        status: existing.status === "AVAILABLE" ? "UNAVAILABLE" : "AVAILABLE",
      },
    });
  },
};