import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";

function normalizeDate(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export const courtEngine = {
  async create(
    prisma: PrismaClient,
    input: {
      name: string;
      address: string;
      description?: string;
      inventory?: string;
    }
  ) {
    const exists = await prisma.court.findFirst({
      where: { name: { equals: input.name, mode: "insensitive" } },
    });
    if (exists) {
      throw new TRPCError({ code: "CONFLICT", message: "Ya existe una cancha con ese nombre" });
    }

    return prisma.$transaction(async (tx) => {
      const court = await tx.court.create({
        data: {
          name: input.name,
          address: input.address,
          description: input.description,
          inventory: input.inventory,
          status: "ENABLED",
        },
      });

      const today = normalizeDate(new Date());
      const availabilityData = [];

      for (let day = 0; day < 14; day++) {
        const date = new Date(today);
        date.setUTCDate(today.getUTCDate() + day);
        
        for (let slot = 0; slot < 12; slot++) {
          availabilityData.push({
            courtId: court.id,
            date,
            timeSlot: slot,
            status: "AVAILABLE" as const,
          });
        }
      }

      await tx.courtAvailability.createMany({ data: availabilityData });

      return court;
    });
  },

  async update(
    prisma: PrismaClient,
    input: {
      courtId: string;
      name?: string;
      address?: string;
      description?: string | null;
      inventory?: string | null;
    }
  ) {
    const court = await prisma.court.findUnique({ where: { id: input.courtId } });
    if (!court) throw new TRPCError({ code: "NOT_FOUND", message: "Cancha no encontrada" });

    if (input.name && input.name !== court.name) {
      const exists = await prisma.court.findFirst({
        where: { name: { equals: input.name, mode: "insensitive" } },
      });
      if (exists) throw new TRPCError({ code: "CONFLICT", message: "Nombre ya en uso" });
    }

    return prisma.court.update({
      where: { id: input.courtId },
      data: {
        name: input.name,
        address: input.address,
        description: input.description,
        inventory: input.inventory,
      },
    });
  },

  async toggleAvailability(
    prisma: PrismaClient,
    input: { courtId: string; date: Date; timeSlot: number }
  ) {
    const court = await prisma.court.findUnique({ where: { id: input.courtId } });
    if (!court) throw new TRPCError({ code: "NOT_FOUND", message: "Cancha no encontrada" });
    if (court.status === "DISABLED") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "La cancha está deshabilitada totalmente" });
    }

    const normalizedDate = normalizeDate(input.date);
    const slot = await prisma.courtAvailability.findUnique({
      where: {
        courtId_date_timeSlot: {
          courtId: input.courtId,
          date: normalizedDate,
          timeSlot: input.timeSlot,
        },
      },
    });

    if (!slot) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Franja fuera de la ventana de 2 semanas" });
    }

    // Punto de acoplamiento Sistema 6:
    // if (slot.status === "AVAILABLE" && hasTournament(slot)) { ... }

    return prisma.courtAvailability.update({
      where: { id: slot.id },
      data: { status: slot.status === "AVAILABLE" ? "UNAVAILABLE" : "AVAILABLE" },
    });
  },

  async disable(prisma: PrismaClient, courtId: string) {
    const court = await prisma.court.findUnique({ where: { id: courtId } });
    if (!court) throw new TRPCError({ code: "NOT_FOUND", message: "Cancha no encontrada" });
    if (court.status === "DISABLED") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "La cancha ya está deshabilitada" });
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.court.update({
        where: { id: courtId },
        data: { status: "DISABLED" },
      });

      await tx.courtAvailability.updateMany({
        where: { courtId },
        data: { status: "UNAVAILABLE" },
      });

      // Punto de acoplamiento Sistema 6:
      // tx.tournament.updateMany({ where: { courtId, status: { in: ["IN_PROGRESS", "SCHEDULED"] } }, data: { status: "SUSPENDED" } })

      return updated;
    });
  },

  async enable(prisma: PrismaClient, courtId: string) {
    const court = await prisma.court.findUnique({ where: { id: courtId } });
    if (!court) throw new TRPCError({ code: "NOT_FOUND", message: "Cancha no encontrada" });

    return prisma.court.update({
      where: { id: courtId },
      data: { status: "ENABLED" },
    });
  },

    // ==========================================
  // NUEVO: Cerrar día completo (Bulk Update)
  // ==========================================
  async setAvailability(
    prisma: PrismaClient,
    input: {
      courtId: string;
      slots: { date: Date; timeSlot: number; status: "AVAILABLE" | "UNAVAILABLE" }[];
    }
  ) {
    const court = await prisma.court.findUnique({ where: { id: input.courtId } });
    if (!court) throw new TRPCError({ code: "NOT_FOUND", message: "Cancha no encontrada" });
    if (court.status === "DISABLED") throw new TRPCError({ code: "BAD_REQUEST", message: "La cancha está deshabilitada" });

    return prisma.$transaction(async (tx) => {
      const updates = input.slots.map(slot => 
        tx.courtAvailability.update({
          where: {
            courtId_date_timeSlot: {
              courtId: input.courtId,
              date: normalizeDate(slot.date),
              timeSlot: slot.timeSlot,
            },
          },
          data: { status: slot.status },
        })
      );
      await Promise.all(updates);
    });
  },

  // ==========================================
  // NUEVO: Mantenimiento de ventana (Cron Job)
  // ==========================================

  // ==========================================
  // MANTENIMIENTO DE VENTANA (FUTURO CRON JOB)
  // ==========================================
  // Esta función está diseñada para ejecutarse diariamente (ej. a las 00:00).
  // Cuando despleguemos en producción, se llamará desde un Vercel Cron Job 
  // configurado en el archivo `vercel.json` apuntando a una ruta API protegida.
  // Por ahora, la lógica está aislada y lista para usarse cuando sea necesario.
  async maintainAvailabilityWindow(prisma: PrismaClient) {
    const today = normalizeDate(new Date());
    const day15 = new Date(today);
    day15.setUTCDate(today.getUTCDate() + 14);

    // 1. Purgar fechas pasadas
    await prisma.courtAvailability.deleteMany({
      where: { date: { lt: today } }
    });

    // 2. Generar día 15 para canchas habilitadas
    const enabledCourts = await prisma.court.findMany({ 
      where: { status: "ENABLED" }, 
      select: { id: true } 
    });

    const newSlots = [];
    for (const court of enabledCourts) {
      for (let slot = 0; slot < 12; slot++) {
        newSlots.push({
          courtId: court.id,
          date: day15,
          timeSlot: slot,
          status: "AVAILABLE" as const,
        });
      }
    }

    if (newSlots.length > 0) {
      await prisma.courtAvailability.createMany({ 
        data: newSlots, 
        skipDuplicates: true 
      });
    }

    return { purged: true, generatedSlots: newSlots.length };
  },
};