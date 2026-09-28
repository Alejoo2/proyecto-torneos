import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";

export type MatrixCellStatus = "AVAILABLE" | "UNAVAILABLE" | "SUGGESTED" | "HARD_CONFLICT";

export interface MatrixCell {
  dayOfWeek: number;
  timeSlot: number;
  status: MatrixCellStatus;
}

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

  /** Guardado por lotes (S02 §6: el cliente acumula ~1 min y envía el delta).
   *  Solo verde/gris viajan: amarillo/rojo son trazados y se rechazan. */
  async setSlots(
    prisma: PrismaClient,
    playerId: string,
    slots: { dayOfWeek: number; timeSlot: number; status: "AVAILABLE" | "UNAVAILABLE" }[],
  ) {
    if (slots.length === 0 || slots.length > 84) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Lote de 1 a 84 celdas" });
    }
    await prisma.$transaction(
      slots.map((s) =>
        prisma.playerAvailability.upsert({
          where: { playerId_dayOfWeek_timeSlot: { playerId, dayOfWeek: s.dayOfWeek, timeSlot: s.timeSlot } },
          update: { status: s.status },
          create: { playerId, dayOfWeek: s.dayOfWeek, timeSlot: s.timeSlot, status: s.status },
        }),
      ),
    );
    return { ok: true, count: slots.length };
  },

  /** Matriz fusionada de 84 celdas (S02 v2.0): base propia + sugerencias de
   *  mis equipos (amarillo) + duros del fixture (rojo). El duro manda.
   *  Mismo torneo ≠ duro: se desambigua en resultados (S10). */
  async getMatrix(prisma: PrismaClient, userId: string): Promise<MatrixCell[]> {
    const profile = await prisma.profile.findUnique({
      where: { userId },
      include: {
        player: {
          include: {
            availabilities: true,
            teamMemberships: { where: { leftAt: null }, select: { teamId: true } },
          },
        },
      },
    });
    const player = profile?.player;
    if (!player) throw new TRPCError({ code: "NOT_FOUND", message: "Jugador no encontrado" });
    const teamIds = player.teamMemberships.map((m) => m.teamId);

    const suggested = teamIds.length > 0
      ? await prisma.teamSuggestedSlot.findMany({ where: { teamId: { in: teamIds } } })
      : [];
    const suggestedSet = new Set(suggested.map((s) => `${s.dayOfWeek}|${s.timeSlot}`));

    // Rojo: misma franja en 2+ torneos DISTINTOS. Tres fuentes (S02 v2.0 +
    // S06 v3.0): fixture programado, torneos inscritos (escalares) y reservas
    // concretas. Mismo torneo ≠ duro (set por slot, no conteo).
    const slotTournaments = new Map<string, Set<string>>();
    const addSlot = (dayOfWeek: number, timeSlot: number, tournamentId: string) => {
      const key = `${dayOfWeek}|${timeSlot}`;
      const set = slotTournaments.get(key) ?? new Set<string>();
      set.add(tournamentId);
      slotTournaments.set(key, set);
    };
    const hardKeys = new Set<string>();
    if (teamIds.length > 0) {
      const enrollments = await prisma.tournamentEnrollment.findMany({
        where: {
          teamId: { in: teamIds },
          status: { in: ["PENDING_AVAILABILITY", "PENDING_PAYMENT", "APPROVED"] },
          tournament: { status: { in: ["SCHEDULED", "GRACE_PERIOD", "IN_PROGRESS"] } },
        },
        select: {
          tournamentId: true,
          tournament: { select: { dayOfWeek: true, timeSlot: true } },
        },
      });
      const enrolledIds = [...new Set(enrollments.map((e) => e.tournamentId))];
      for (const e of enrollments) {
        addSlot(e.tournament.dayOfWeek, e.tournament.timeSlot, e.tournamentId);
      }
      if (enrolledIds.length > 0) {
        const reservations = await prisma.tournamentSlotReservation.findMany({
          where: { tournamentId: { in: enrolledIds } },
          select: { tournamentId: true, date: true, timeSlot: true },
        });
        for (const r of reservations) {
          addSlot(new Date(r.date).getUTCDay(), r.timeSlot, r.tournamentId);
        }
      }
      const matches = await prisma.match.findMany({
        where: {
          status: { in: ["SCHEDULED", "IN_PROGRESS"] },
          date: { not: null },
          timeSlot: { not: null },
          OR: [{ homeTeamId: { in: teamIds } }, { awayTeamId: { in: teamIds } }],
        },
        select: { tournamentId: true, date: true, timeSlot: true },
      });
      for (const m of matches) {
        if (!m.date || m.timeSlot === null) continue;
        addSlot(new Date(m.date).getUTCDay(), m.timeSlot, m.tournamentId);
      }
      for (const [key, tournaments] of slotTournaments) {
        if (tournaments.size >= 2) hardKeys.add(key);
      }
    }

    // S02 v2.0 + regla amarilla: sugerido solo pinta si la base NO es AVAILABLE
    // (sugerido + verde = verde). Amarillo = sugerido en tus no-disponibles.
    const baseMap = new Map(player.availabilities.map((a) => [`${a.dayOfWeek}|${a.timeSlot}`, a.status]));
    const cells: MatrixCell[] = [];
    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
      for (let timeSlot = 0; timeSlot < 12; timeSlot++) {
        const key = `${dayOfWeek}|${timeSlot}`;
        const base = baseMap.get(key);
        const status: MatrixCellStatus = hardKeys.has(key)
          ? "HARD_CONFLICT"
          : suggestedSet.has(key) && base !== "AVAILABLE"
            ? "SUGGESTED"
            : base === "AVAILABLE"
              ? "AVAILABLE"
              : "UNAVAILABLE";
        cells.push({ dayOfWeek, timeSlot, status });
      }
    }
    return cells;
  },
};