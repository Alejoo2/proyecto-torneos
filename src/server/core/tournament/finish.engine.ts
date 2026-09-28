import type { Prisma } from "@prisma/client";
import { NotificationFamily, NotificationType } from "@prisma/client";
import { notificationEngine } from "torneos/server/core/notification/notification.engine";

type PrismaTx = Prisma.TransactionClient;

/**
 * S10 §6 — FINISHED automático (decisión del dueño). Cuadro completo = última
 * fase con todos sus partidos con resultado. Libera reservas (vuelven a
 * AVAILABLE), pasa el torneo a FINISHED y avisa a gestor + capitanes.
 * Vive en tx del llamador (load o walkover). Retorna si finalizó.
 */
export async function maybeFinishTournament(tx: PrismaTx, tournamentId: string): Promise<boolean> {
  const lastPhase = await tx.tournamentPhase.findFirst({
    where: { tournamentId },
    orderBy: { order: "desc" },
  });
  if (!lastPhase) return false;
  const finals = await tx.match.findMany({
    where: { phaseId: lastPhase.id },
    select: { id: true, result: { select: { id: true } } },
  });
  if (finals.length === 0 || !finals.every((m) => m.result)) return false;

  const reservations = await tx.tournamentSlotReservation.findMany({
    where: { tournamentId },
    select: { courtId: true, date: true, timeSlot: true },
  });
  await tx.tournamentSlotReservation.deleteMany({ where: { tournamentId } });
  for (const r of reservations) {
    await tx.courtAvailability.updateMany({
      where: { courtId: r.courtId, date: r.date, timeSlot: r.timeSlot },
      data: { status: "AVAILABLE" },
    });
  }
  await tx.tournament.update({
    where: { id: tournamentId },
    data: { status: "FINISHED" },
  });
  const full = await tx.tournament.findUnique({
    where: { id: tournamentId },
    select: {
      name: true,
      manager: { select: { profile: { select: { userId: true } } } },
      enrollments: {
        select: {
          team: {
            select: {
              memberships: {
                where: { isCaptain: true, leftAt: null },
                select: { player: { select: { profile: { select: { userId: true } } } } },
              },
            },
          },
        },
      },
    },
  });
  if (full) {
    const recipients = new Set<string>([full.manager.profile.userId]);
    for (const e of full.enrollments) {
      for (const m of e.team.memberships) recipients.add(m.player.profile.userId);
    }
    for (const userId of recipients) {
      await notificationEngine.create(tx, {
        userId,
        family: NotificationFamily.TOURNAMENT,
        type: NotificationType.TOURNAMENT_FINISHED,
        title: `${full.name} finalizó`,
        body: "Torneo completado. Las franjas apartadas quedaron libres.",
        payload: { tournamentId },
      });
    }
  }
  return true;
}
