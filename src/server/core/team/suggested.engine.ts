import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@prisma/client";

/**
 * S03 §7 — matriz sugerida del capitán (amarillo, lectura para el jugador).
 * Reemplazo total del set por equipo. Sin timers, sin bloqueos.
 */
export const suggestedEngine = {
  async setSuggestedSlots(
    db: PrismaClient,
    input: { teamId: string; slots: { dayOfWeek: number; timeSlot: number }[] },
    userId: string,
  ) {
    const captaincy = await db.teamMembership.findFirst({
      where: { teamId: input.teamId, isCaptain: true, leftAt: null, player: { profile: { userId } } },
      select: { id: true, playerId: true },
    });
    if (!captaincy) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Solo el capitán sugiere horario" });
    }
    if (input.slots.length > 84) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Máximo 84 sugerencias" });
    }
    await db.$transaction(async (tx) => {
      await tx.teamSuggestedSlot.deleteMany({ where: { teamId: input.teamId } });
      if (input.slots.length > 0) {
        await tx.teamSuggestedSlot.createMany({
          data: input.slots.map((s) => ({
            teamId: input.teamId,
            dayOfWeek: s.dayOfWeek,
            timeSlot: s.timeSlot,
            suggestedBy: captaincy.playerId,
          })),
        });
      }
    });
    return { ok: true, count: input.slots.length };
  },

  async listByTeam(db: PrismaClient, teamId: string) {
    return db.teamSuggestedSlot.findMany({
      where: { teamId },
      orderBy: [{ dayOfWeek: "asc" }, { timeSlot: "asc" }],
    });
  },
};
