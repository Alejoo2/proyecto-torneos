import type { PrismaClient, Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { notificationEngine } from "../notification/notification.engine";

/**
 * W10 — Cascada "Cancha Manda" (enmienda ADITIVA en archivo propio: los engines
 * existentes disable/setAvailability quedan intactos y en producción).
 *
 * Regla del dueño: la cancha tiene el mayor poder. Bloquear franja(s) o deshabilitar
 * la cancha aplaza automáticamente los partidos futuros afectados:
 *   POSTPONED + scheduledAt/date/timeSlot = NULL ("pendiente de asignación de horario").
 * JAMÁS toca FINISHED/WALKOVER/CANCELLED ni resultados/stats/standings.
 * Notifica: convocados del partido (o capitanes si aún no hay convocatoria) + gestor.
 * Tx con timeout explícito (precedente generateFromDraw). Riesgo B-18 conocido si
 * aplaza decenas de partidos con convocatorias grandes.
 */

const POSTPONE_REASON = "Indisponibilidad de cancha por decisión administrativa";
const ACTIVE_STATUSES = ["SCHEDULED", "IN_PROGRESS"] as const;
const TX_OPTS = { timeout: 20_000, maxWait: 10_000 };

type Tx = Prisma.TransactionClient;

const dateOnlyUTC = (d: Date) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

export interface CascadeSlotInput {
  date: Date;
  timeSlot: number;
}

type AffectedMatch = Prisma.PromiseReturnType<typeof findAffected>[number];

async function findAffected(tx: Tx, courtId: string, slots: CascadeSlotInput[] | null) {
  return tx.match.findMany({
    where: {
      courtId,
      status: { in: [...ACTIVE_STATUSES] },
      ...(slots && slots.length > 0
        ? {
            OR: slots.map((s) => ({
              date: dateOnlyUTC(s.date),
              timeSlot: s.timeSlot,
            })),
          }
        : {}),
    },
    select: {
      id: true,
      tournamentId: true,
      date: true,
      timeSlot: true,
      tournament: {
        select: { name: true, manager: { select: { profile: { select: { userId: true } } } } },
      },
    },
  });
}

async function postponeOneMatch(tx: Tx, match: AffectedMatch, actorUserId: string) {
  await tx.match.update({
    where: { id: match.id },
    data: {
      status: "POSTPONED",
      postponedReason: POSTPONE_REASON,
      postponedAt: new Date(),
      postponedBy: actorUserId,
      scheduledAt: null,
      date: null,
      timeSlot: null,
    },
  });

  // Convocados; si aún no hay convocatoria, capitanes de los equipos
  const callUps = await tx.matchCallUp.findMany({
    where: { matchId: match.id },
    select: { player: { select: { profile: { select: { userId: true } } } } },
  });
  const recipients = new Set<string>();
  for (const c of callUps) {
    const uid = c.player.profile?.userId;
    if (uid) recipients.add(uid);
  }
  if (recipients.size === 0) {
    const m = await tx.match.findUnique({
      where: { id: match.id },
      select: { homeTeamId: true, awayTeamId: true },
    });
    const teamIds = [m?.homeTeamId, m?.awayTeamId].filter((x): x is string => Boolean(x));
    if (teamIds.length > 0) {
      const captains = await tx.teamMembership.findMany({
        where: { teamId: { in: teamIds }, isCaptain: true, leftAt: null },
        select: { player: { select: { profile: { select: { userId: true } } } } },
      });
      for (const c of captains) {
        const uid = c.player.profile?.userId;
        if (uid) recipients.add(uid);
      }
    }
  }
  await Promise.all(
    [...recipients].map((userId) =>
      notificationEngine.create(tx, {
        userId,
        family: "MATCH",
        type: "MATCH_POSTPONED",
        title: "Partido aplazado",
        body: "Tu partido fue aplazado por indisponibilidad de la cancha. Queda pendiente de asignación de horario.",
        payload: { matchId: match.id, tournamentId: match.tournamentId },
      }),
    ),
  );

  const managerUserId = match.tournament.manager.profile?.userId;
  if (managerUserId) {
    await notificationEngine.create(tx, {
      userId: managerUserId,
      family: "MATCH",
      type: "MATCH_POSTPONED",
      title: "Partido aplazado por cancha",
      body: `Un partido de ${match.tournament.name} quedó pendiente de asignación de horario (cancha cerrada por administración).`,
      payload: { matchId: match.id, tournamentId: match.tournamentId },
    });
  }
}

export const courtCascadeEngine = {
  /** Read-only: partidos que serían aplazados. slots=null ⇒ toda la cancha. */
  async getBlockImpact(
    prisma: PrismaClient,
    courtId: string,
    slots: CascadeSlotInput[] | null,
  ) {
    const court = await prisma.court.findUnique({ where: { id: courtId }, select: { id: true } });
    if (!court) throw new TRPCError({ code: "NOT_FOUND", message: "Cancha no encontrada" });

    const affected = slots === null
      ? await findAffectedTx(prisma, courtId)
      : await findAffectedDirect(prisma, courtId, slots);

    return {
      count: affected.length,
      matches: affected.map((m) => ({
        id: m.id,
        tournamentName: m.tournament.name,
        date: m.date,
        timeSlot: m.timeSlot,
      })),
    };
  },

  async disableWithCascade(prisma: PrismaClient, courtId: string, actorUserId: string) {
    const court = await prisma.court.findUnique({ where: { id: courtId } });
    if (!court) throw new TRPCError({ code: "NOT_FOUND", message: "Cancha no encontrada" });
    if (court.status === "DISABLED") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "La cancha ya está deshabilitada" });
    }

    return prisma.$transaction(async (tx) => {
      await tx.court.update({ where: { id: courtId }, data: { status: "DISABLED" } });
      await tx.courtAvailability.updateMany({ where: { courtId }, data: { status: "UNAVAILABLE" } });

      const affected = await findAffected(tx, courtId, null);
      for (const m of affected) await postponeOneMatch(tx, m, actorUserId);

      // Gestores de torneos activos en la cancha (patrón del disable original)
      const tournaments = await tx.tournament.findMany({
        where: { courtId, status: { in: ["SCHEDULED", "GRACE_PERIOD", "IN_PROGRESS"] } },
        select: { manager: { select: { profile: { select: { userId: true } } } } },
      });
      const managerUserIds = new Set(
        tournaments.map((t) => t.manager.profile?.userId).filter((x): x is string => Boolean(x)),
      );
      await Promise.all(
        [...managerUserIds].map((userId) =>
          notificationEngine.create(tx, {
            userId,
            family: "COURT",
            type: "COURT_DISABLED",
            title: "Cancha deshabilitada",
            body: `La cancha ${court.name} fue deshabilitada por administración.${
              affected.length > 0 ? ` ${affected.length} partido(s) quedaron pendientes de horario.` : ""
            }`,
            payload: { courtId },
          }),
        ),
      );

      return { postponed: affected.length };
    }, TX_OPTS);
  },

  async setAvailabilityWithCascade(
    prisma: PrismaClient,
    input: { courtId: string; slots: (CascadeSlotInput & { status: "AVAILABLE" | "UNAVAILABLE" })[] },
    actorUserId: string,
  ) {
    const court = await prisma.court.findUnique({ where: { id: input.courtId } });
    if (!court) throw new TRPCError({ code: "NOT_FOUND", message: "Cancha no encontrada" });
    if (court.status === "DISABLED") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "La cancha está deshabilitada" });
    }

    return prisma.$transaction(async (tx) => {
      await Promise.all(
        input.slots.map((s) =>
          tx.courtAvailability.upsert({
            where: {
              courtId_date_timeSlot: {
                courtId: input.courtId,
                date: dateOnlyUTC(s.date),
                timeSlot: s.timeSlot,
              },
            },
            update: { status: s.status },
            create: {
              courtId: input.courtId,
              date: dateOnlyUTC(s.date),
              timeSlot: s.timeSlot,
              status: s.status,
            },
          }),
        ),
      );

      const closing = input.slots.filter((s) => s.status === "UNAVAILABLE");
      const affected = closing.length > 0 ? await findAffected(tx, input.courtId, closing) : [];
      for (const m of affected) await postponeOneMatch(tx, m, actorUserId);

      return { postponed: affected.length };
    }, TX_OPTS);
  },
};

// Read-only fuera de tx (getBlockImpact)
function findAffectedTx(_prisma: PrismaClient, _courtId: string) {
  return [] as never[]; // no se usa: ver findAffectedDirect
}
function findAffectedDirect(prisma: PrismaClient, courtId: string, slots: CascadeSlotInput[] | null) {
  return prisma.match.findMany({
    where: {
      courtId,
      status: { in: [...ACTIVE_STATUSES] },
      ...(slots && slots.length > 0
        ? { OR: slots.map((s) => ({ date: dateOnlyUTC(s.date), timeSlot: s.timeSlot })) }
        : {}),
    },
    select: {
      id: true,
      tournamentId: true,
      date: true,
      timeSlot: true,
      tournament: {
        select: { name: true, manager: { select: { profile: { select: { userId: true } } } } },
      },
    },
  });
}