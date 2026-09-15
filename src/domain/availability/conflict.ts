export interface AvailabilitySlot {
  dayOfWeek: number; // 0=DOM ... 6=SÁB
  timeSlot: number;  // 0-11
  status: "AVAILABLE" | "UNAVAILABLE";
}

export interface MatchSlot {
  date: Date | string; // Match.date (@db.Date, medianoche UTC); superjson lo revive como Date
  timeSlot: number;
}

export interface ConflictCell {
  dayOfWeek: number;
  timeSlot: number;
}

const cellKey = (d: number, t: number) => `${d}-${t}`;

/**
 * B-10: proyección de conflictos SIN fetch.
 * Un slot es conflicto si el jugador lo marcó UNAVAILABLE
 * y tiene un partido agendado en ese día+franja.
 */
export function projectConflicts(
  availability: AvailabilitySlot[],
  matches: MatchSlot[],
): ConflictCell[] {
  const unavailable = new Set(
    availability
      .filter((a) => a.status === "UNAVAILABLE")
      .map((a) => cellKey(a.dayOfWeek, a.timeSlot)),
  );

  const matchSlots = new Set<string>();
  for (const m of matches) {
    if (m.date == null || m.timeSlot == null) continue;
    const d = m.date instanceof Date ? m.date : new Date(m.date);
    matchSlots.add(cellKey(d.getUTCDay(), m.timeSlot)); // UTC: así se almacenan las fechas
  }

  return [...unavailable]
    .filter((k) => matchSlots.has(k))
    .map((k) => {
      const parts = k.split("-");
      const dayOfWeek = Number(parts[0]);
      const timeSlot = Number(parts[1]);
      return { dayOfWeek, timeSlot };
    });
}