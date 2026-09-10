import "server-only";

import type { PrismaClient } from "@prisma/client";

import { ACTIVE_TOURNAMENT_STATUSES, SLOTS_PER_DAY } from "torneos/lib/hub";

type DB = PrismaClient;

const toUtcMidnight = (date: Date): Date =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

const addUtcDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

/**
 * Read-model ligero para los pines del mapa + filtros del Hub.
 */
export async function getMapData(db: DB) {
  const today = toUtcMidnight(new Date());
  const tomorrow = addUtcDays(today, 1);

  const courts = await db.court.findMany({
    select: {
      id: true,
      name: true,
      address: true,
      lat: true,
      lon: true,
      status: true,
      tournaments: {
        where: { status: { in: [...ACTIVE_TOURNAMENT_STATUSES] } },
        select: { id: true },
      },
      availability: {
        where: { date: { gte: today, lt: tomorrow }, status: "AVAILABLE" },
        select: { timeSlot: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return courts.map((court) => ({
    id: court.id,
    name: court.name,
    address: court.address,
    lat: court.lat,
    lon: court.lon,
    status: court.status,
    hasTournaments: court.tournaments.length > 0,
    // MODELO ALLOWLIST: sin registro = cerrado (igual que CourtAvailabilityMatrix).
    // Si tu regla es la inversa, cambia esta línea.
    hasSlotsToday: court.availability.length > 0,
  }));
}

/**
 * Read-model de la burbuja: cancha + matriz 7×12 + torneos activos.
 */
export async function getBubbleData(db: DB, courtId: string) {
  const today = toUtcMidnight(new Date());
  const weekEnd = addUtcDays(today, 7);

  const [court, tournaments, availability] = await Promise.all([
    db.court.findUnique({
      where: { id: courtId },
      select: {
        id: true,
        name: true,
        address: true,
        description: true,
        inventory: true,
        status: true,
      },
    }),
    db.tournament.findMany({
      where: { courtId, status: { in: [...ACTIVE_TOURNAMENT_STATUSES] } },
      select: {
        id: true,
        name: true,
        status: true,
        dayOfWeek: true,
        timeSlot: true,
        maxTeams: true,
        _count: { select: { enrollments: { where: { status: "APPROVED" } } } },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.courtAvailability.findMany({
      where: { courtId, date: { gte: today, lt: weekEnd } },
      select: { date: true, timeSlot: true, status: true },
    }),
  ]);

  if (!court) return null;

  const openSlots = new Set(
    availability
      .filter((a) => a.status === "AVAILABLE")
      .map((a) => `${a.date.toISOString()}|${a.timeSlot}`),
  );

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addUtcDays(today, i);
    const dateKey = date.toISOString();
    const dayOfWeek = date.getUTCDay(); // 0 = domingo

    return {
      date: dateKey,
      dayOfWeek,
      slots: Array.from({ length: SLOTS_PER_DAY }, (_, timeSlot) => ({
        timeSlot,
        // Libre = abierta explícitamente Y ningún torneo activo la ocupa
        isFree:
          openSlots.has(`${dateKey}|${timeSlot}`) &&
          !tournaments.some((t) => t.dayOfWeek === dayOfWeek && t.timeSlot === timeSlot),
      })),
    };
  });

  return {
    id: court.id,
    name: court.name,
    address: court.address,
    description: court.description,
    inventory: court.inventory,
    status: court.status,
    days,
    tournaments: tournaments.map((t) => ({
      id: t.id,
      name: t.name,
      status: t.status,
      dayOfWeek: t.dayOfWeek,
      timeSlot: t.timeSlot,
      approvedTeams: t._count.enrollments,
      maxTeams: t.maxTeams,
    })),
  };
}