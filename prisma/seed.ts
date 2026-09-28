import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

// PRNG determinista: mismos datos en cada corrida, sin dependencias externas
function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(42);
const randInt = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;

const daysFromTodayUTC = (days: number) => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
};
const pastMatchDate = (daysAgo: number) => {
  const d = daysFromTodayUTC(-daysAgo);
  d.setUTCHours(18, 0, 0, 0); // 18:00, dentro de la franja del torneo
  return d;
};
const dateOnly = (d: Date) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

// Referencias compartidas entre secciones
const db = {
  userIdByEmail: new Map<string, string>(),
  playerIdByEmail: new Map<string, string>(),
  managerId: null as string | null,
  teamIdByName: new Map<string, string>(),
  courtIdByName: new Map<string, string>(),
  tournamentIds: {} as { finished?: string; pending?: string },
};

async function seedPermissions() {
  const permissionsData = [
    { code: "user:manage", name: "Gestionar usuarios", module: "user" },
    { code: "manager:create", name: "Crear gestores", module: "user" },
    { code: "manager:disable", name: "Habilitar/deshabilitar gestores", module: "user" },
    { code: "court:create", name: "Crear canchas públicas", module: "court" },
    { code: "court:edit", name: "Editar canchas públicas", module: "court" },
    { code: "court:disable", name: "Habilitar/deshabilitar canchas", module: "court" },
    { code: "court:view", name: "Ver canchas", module: "court" },
    { code: "tournament:create", name: "Crear torneos", module: "tournament" },
    { code: "tournament:manage", name: "Gestionar sus torneos", module: "tournament" },
    { code: "tournament:approve", name: "Aprobar/rechazar torneos", module: "tournament" },
    { code: "team:invite", name: "Invitar jugadores", module: "team" },
    { code: "team:manage", name: "Gestionar equipo", module: "team" },
    { code: "match:postpone", name: "Aplazar partidos", module: "match" },
    { code: "match:result", name: "Cargar resultados de partido", module: "match" },
    { code: "rbac:manage", name: "Gestionar roles y permisos", module: "rbac" },
    { code: "referee:manage", name: "Gestionar árbitros", module: "match" },
  ];

  await prisma.permission.createMany({ data: permissionsData, skipDuplicates: true });
  const rows = await prisma.permission.findMany();
  console.log(`✅ Permisos: ${rows.length}`);
  return Object.fromEntries(rows.map((p) => [p.code, p.id]));
}

async function seedRoles() {
  const rolesData = [
    { name: "admin", description: "Administrador global.", isSystem: true },
    { name: "manager", description: "Gestor de torneos.", isSystem: true },
    { name: "player", description: "Jugador base.", isSystem: true },
    { name: "captain", description: "Capitán de equipo.", isSystem: true },
  ];
  for (const role of rolesData) {
    await prisma.role.upsert({ where: { name: role.name }, update: {}, create: role });
  }
  console.log(`✅ Roles: ${rolesData.length}`);
}async function seedRolePermissions(perms: Record<string, string>) {
  const dbRoles = await prisma.role.findMany();
  const roles = Object.fromEntries(dbRoles.map((r) => [r.name, r.id]));

  const rolePermissionsMap: Record<string, string[]> = {
    admin: ["user:manage", "manager:create", "manager:disable", "court:create", "court:edit", "court:disable", "court:view", "tournament:approve", "rbac:manage", "referee:manage"],    manager: ["court:view", "tournament:create", "tournament:manage", "match:postpone", "match:result"],
    player: ["court:view"],
    captain: ["court:view", "team:invite", "team:manage"],
  };

  const data = Object.entries(rolePermissionsMap).flatMap(([roleName, codes]) =>
    codes.map((code) => ({ roleId: roles[roleName]!, permissionId: perms[code]! }))
  );
  await prisma.rolePermission.createMany({ data, skipDuplicates: true });
  console.log(`✅ Rol-Permisos: ${data.length} asignaciones`);
}async function seedUsers() {
  const [adminRole, managerRole, playerRole, captainRole] = await Promise.all([
    prisma.role.findUnique({ where: { name: "admin" } }),
    prisma.role.findUnique({ where: { name: "manager" } }),
    prisma.role.findUnique({ where: { name: "player" } }),
    prisma.role.findUnique({ where: { name: "captain" } }),
  ]);

  const assignRole = async (profileId: string, roleId?: string | null) => {
    if (!roleId) return;
    await prisma.roleAssignment.upsert({
      where: { profileId_roleId: { profileId, roleId } },
      update: {},
      create: { profileId, roleId },
    });
  };

  // --- Admin (sin Player: no juega) ---
  {
    const user = await prisma.user.upsert({
      where: { email: "admin@admin" },
      update: {},
      create: { email: "admin@admin", name: "Admin", emailVerified: new Date() },
    });
    const profile = await prisma.profile.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id, displayName: "Administrador", onboarded: true },
    });
    await assignRole(profile.id, adminRole?.id);
    db.userIdByEmail.set("admin@admin", user.id);
  }

  // --- Gestor (Manager activo) ---
  {
    const user = await prisma.user.upsert({
      where: { email: "gestor@gestor" },
      update: {},
      create: { email: "gestor@gestor", name: "Gestor", emailVerified: new Date() },
    });
    const profile = await prisma.profile.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id, displayName: "Gestor de Torneos", onboarded: true },
    });
    await assignRole(profile.id, managerRole?.id);
    const manager = await prisma.manager.upsert({
      where: { profileId: profile.id },
      update: { isActive: true },
      create: { profileId: profile.id, isActive: true },
    });
    // QA Fase 0: el gestor también es jugador (si no, profile-view bloquea
    // la pestaña Gestor con "Aún no eres jugador"). Matriz mínima de prueba.
    const gestorPlayer = await prisma.player.upsert({
      where: { profileId: profile.id },
      update: {},
      create: { profileId: profile.id },
    });
    for (const day of [2, 4, 6]) {
      for (const slot of [7, 8, 9]) {
        await prisma.playerAvailability.upsert({
          where: { playerId_dayOfWeek_timeSlot: { playerId: gestorPlayer.id, dayOfWeek: day, timeSlot: slot } },
          update: {},
          create: { playerId: gestorPlayer.id, dayOfWeek: day, timeSlot: slot, status: "AVAILABLE" },
        });
      }
    }
    db.userIdByEmail.set("gestor@gestor", user.id);
    db.managerId = manager.id;
  }

  // --- 30 jugadores de prueba ---
  const TEST_DAYS = [2, 4, 6];  // martes, jueves, sábado (el 6 = día de los torneos)
  const TEST_SLOTS = [7, 8, 9]; // 14–20h (cubre el slot 9 de los torneos)

  for (let i = 1; i <= 30; i++) {
    const email = `test${i}@test`;
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, name: `Test ${i}`, emailVerified: new Date() },
    });
    const profile = await prisma.profile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        displayName: `Jugador Test ${i}`,
        phone: `+57 320 000 00${String(i).padStart(2, "0")}`,
        birthDate: daysFromTodayUTC(-365 * (18 + (i % 15))),
        onboarded: true,
      },
    });

    const isCaptain = i === 1 || i === 16;
    await assignRole(profile.id, playerRole?.id);
    if (isCaptain) await assignRole(profile.id, captainRole?.id);

    const player = await prisma.player.upsert({
      where: { profileId: profile.id },
      update: {},
      create: { profileId: profile.id },
    });

    for (const day of TEST_DAYS) {
      for (const slot of TEST_SLOTS) {
        await prisma.playerAvailability.upsert({
          where: { playerId_dayOfWeek_timeSlot: { playerId: player.id, dayOfWeek: day, timeSlot: slot } },
          update: {},
          create: { playerId: player.id, dayOfWeek: day, timeSlot: slot, status: "AVAILABLE" },
        });
      }
    }

    db.userIdByEmail.set(email, user.id);
    db.playerIdByEmail.set(email, player.id);
  }
  console.log("✅ Usuarios: 1 admin, 1 gestor, 30 jugadores (capitanes: test1@test y test16@test)");
}async function seedCourts() {
  const courts = [
    { name: "Cancha El Sol", address: "Centro, Sogamoso", lat: 5.7184, lon: -72.9321, description: "Microfútbol con arcos, redes y vestuarios.", inventory: "Arcos, redes, 4 pelotas, vestuarios" },
    { name: "Cancha La Villa", address: "Parque Principal, Nobsa", lat: 5.7683, lon: -72.8445, description: "Amplia, con iluminación nocturna.", inventory: "Arcos, redes, 6 pelotas, bancas" },
    { name: "Cancha Malcasado", address: "Vía a Belén, Nobsa", lat: 5.7550, lon: -72.8600, description: "Cancha comunitaria recién inaugurada.", inventory: "Arcos, redes, 2 pelotas" },
  ];
  for (const c of courts) {
    const court = await prisma.court.upsert({
      where: { name: c.name },
      update: { lat: c.lat, lon: c.lon, status: "ENABLED" },
      create: { ...c, status: "ENABLED" },
    });
    db.courtIdByName.set(court.name, court.id);
  }

  // Árbitro de prueba
  const ref = await prisma.referee.findFirst({ where: { name: "Árbitro Test" } });
  if (!ref) await prisma.referee.create({ data: { name: "Árbitro Test", phone: "+57 310 111 2233" } });

  // Disponibilidad 7 días × slots 6–10
  const OPEN_SLOTS = [6, 7, 8, 9, 10];
  await prisma.courtAvailability.deleteMany({ where: { date: { lt: daysFromTodayUTC(0) } } });
  for (const courtId of db.courtIdByName.values()) {
    for (let d = 0; d < 7; d++) {
      const date = daysFromTodayUTC(d);
      for (const timeSlot of OPEN_SLOTS) {
        await prisma.courtAvailability.upsert({
          where: { courtId_date_timeSlot: { courtId, date, timeSlot } },
          update: { status: "AVAILABLE" },
          create: { courtId, date, timeSlot, status: "AVAILABLE" },
        });
      }
    }
  }
  console.log("✅ Canchas: 3 habilitadas + disponibilidad 7 días + 1 árbitro");
}async function seedTeams() {
  const teamDefs = [
    { name: "Alfa FC", abbreviation: "ALF", primaryColor: "#10B981", captain: "test1@test", from: 1, to: 15 },
    { name: "Bravo FC", abbreviation: "BRV", primaryColor: "#3B82F6", captain: "test16@test", from: 16, to: 30 },
  ];

  for (const t of teamDefs) {
    const team = await prisma.team.upsert({
      where: { name: t.name },
      update: {},
      create: {
        name: t.name,
        abbreviation: t.abbreviation,
        primaryColor: t.primaryColor,
        description: `Equipo de prueba. Capitán: ${t.captain}`,
        status: "ACTIVE",
      },
    });
    db.teamIdByName.set(t.name, team.id);

    for (let i = t.from; i <= t.to; i++) {
      const playerId = db.playerIdByEmail.get(`test${i}@test`)!;
      await prisma.teamMembership.upsert({
        where: { playerId_teamId: { playerId, teamId: team.id } },
        update: { leftAt: null, isCaptain: `test${i}@test` === t.captain },
        create: { teamId: team.id, playerId, isCaptain: `test${i}@test` === t.captain },
      });
    }
  }
  console.log("✅ Equipos: Alfa FC y Bravo FC (15 c/u, ACTIVE)");
}async function ensureTournament(data: Prisma.TournamentCreateInput) {
  const found = await prisma.tournament.findFirst({ where: { name: data.name } });
  return found ?? prisma.tournament.create({ data });
}

async function ensurePhase(tournamentId: string, name: string, order: number) {
  const found = await prisma.tournamentPhase.findFirst({ where: { tournamentId, order } });
  return found ?? prisma.tournamentPhase.create({ data: { tournamentId, name, order } });
}

async function ensureEnrollment(tournamentId: string, teamId: string, adminId: string) {
  await prisma.tournamentEnrollment.upsert({
    where: { tournamentId_teamId: { tournamentId, teamId } },
    update: { status: "APPROVED" },
    create: { tournamentId, teamId, status: "APPROVED", approvedAt: new Date(), approvedBy: adminId },
  });
}

async function createCallUps(matchId: string, teamName: "Alfa FC" | "Bravo FC", playedAt: Date, absentEmails: string[]) {
  const teamId = db.teamIdByName.get(teamName)!;
  const [from, to, captainEmail] = teamName === "Alfa FC" ? [1, 15, "test1@test"] : [16, 30, "test16@test"];
  for (let i = from; i <= to; i++) {
    const email = `test${i}@test`;
    await prisma.matchCallUp.create({
      data: {
        matchId,
        teamId,
        playerId: db.playerIdByEmail.get(email)!,
        isAbsent: absentEmails.includes(email),
        markedBy: db.userIdByEmail.get(captainEmail)!,
        markedAt: playedAt,
      },
    });
  }
}

async function seedFinishedTournament() {
  const adminId = db.userIdByEmail.get("admin@admin")!;
  const gestorId = db.userIdByEmail.get("gestor@gestor")!;

  const tournament = await ensureTournament({
    name: "Liga Test Finalizada",
    description: "Torneo completo: resultados y estadísticas ya cargados.",
    status: "FINISHED",
    format: "LEAGUE",
    type: "PUBLIC",
    maxTeams: 4,
    court: { connect: { id: db.courtIdByName.get("Cancha El Sol")! } },
    manager: { connect: { id: db.managerId! } },
    enrollmentDeadline: daysFromTodayUTC(-21),
    startDate: daysFromTodayUTC(-14),
    dayOfWeek: 6, // sábado
    timeSlot: 9,  // 18:00–20:00
  });

  const phase = await ensurePhase(tournament.id, "Liga Regular", 1);
  for (const teamId of db.teamIdByName.values()) await ensureEnrollment(tournament.id, teamId, adminId);

  const alreadySeeded = await prisma.match.count({ where: { tournamentId: tournament.id } });
  if (alreadySeeded > 0) {
    console.log("ℹ️  Liga Test Finalizada ya tenía partidos; se omite creación.");
    db.tournamentIds.finished = tournament.id;
    return;
  }

  // Guion: goles fijos (resultados conocidos), tarjetas/faltas deterministas
  const SCRIPTS = [
    { home: "Alfa FC", away: "Bravo FC", playedAt: pastMatchDate(14), scorers: { "test1@test": 2, "test5@test": 1, "test20@test": 2 } as Record<string, number>, absent: ["test30@test"] }, // Alfa 3-2 Bravo
    { home: "Bravo FC", away: "Alfa FC", playedAt: pastMatchDate(7), scorers: { "test3@test": 1, "test7@test": 2 } as Record<string, number>, absent: ["test15@test"] }, // Bravo 0-3 Alfa
  ];
  const refereeId = (await prisma.referee.findFirst({ where: { name: "Árbitro Test" } }))?.id;

  for (const s of SCRIPTS) {
    const homeTeamId = db.teamIdByName.get(s.home)!;
    const awayTeamId = db.teamIdByName.get(s.away)!;

    const match = await prisma.match.create({
      data: {
        tournamentId: tournament.id,
        phaseId: phase.id,
        homeTeamId, awayTeamId,
        courtId: tournament.courtId,
        refereeId,
        scheduledAt: s.playedAt,
        date: dateOnly(s.playedAt),
        timeSlot: tournament.timeSlot,
        status: "FINISHED",
      },
    });

    await createCallUps(match.id, s.home as "Alfa FC", s.playedAt, s.absent);
    await createCallUps(match.id, s.away as "Bravo FC", s.playedAt, s.absent);

    // Stats individuales + totales derivados de ellas
    let homeGoals = 0, awayGoals = 0;
    for (const teamName of [s.home, s.away] as const) {
      const teamId = db.teamIdByName.get(teamName)!;
      const [from, to] = teamName === "Alfa FC" ? [1, 15] : [16, 30];
      for (let i = from; i <= to; i++) {
        const email = `test${i}@test`;
        if (s.absent.includes(email)) continue;
        const goals = s.scorers[email] ?? 0;
        await prisma.matchPlayerStat.create({
          data: {
            matchId: match.id,
            playerId: db.playerIdByEmail.get(email)!,
            teamId,
            goals,
            yellowCards: rand() < 0.25 ? 1 : 0,
            blueCards: rand() < 0.12 ? 1 : 0,
            redCards: rand() < 0.06 ? 1 : 0,
            fouls: randInt(0, 4),
          },
        });
        if (teamName === s.home) homeGoals += goals;
        else awayGoals += goals;
      }
    }

    await prisma.matchResult.create({
      data: {
        matchId: match.id,
        homeScore: homeGoals,
        awayScore: awayGoals,
        winnerId: homeGoals > awayGoals ? homeTeamId : awayGoals > homeGoals ? awayTeamId : null,
        notes: `${s.home} ${homeGoals} : ${awayGoals} ${s.away}`,
        loadedBy: gestorId,
        loadedAt: new Date(s.playedAt.getTime() + 2 * 60 * 60 * 1000), // cargado 2h después del partido
      },
    });
  }

  db.tournamentIds.finished = tournament.id;
  console.log("✅ Torneo finalizado: 2 partidos FINISHED con convocatorias, stats y resultados");
}async function seedPendingResultsTournament() {
  const adminId = db.userIdByEmail.get("admin@admin")!;

  const tournament = await ensureTournament({
    name: "Copa Test En Curso",
    description: "Partidos jugados a la espera de carga de resultados (IN_PROGRESS).",
    status: "IN_PROGRESS",
    format: "LEAGUE",
    type: "PUBLIC",
    maxTeams: 4,
    court: { connect: { id: db.courtIdByName.get("Cancha La Villa")! } },
    manager: { connect: { id: db.managerId! } },
    enrollmentDeadline: daysFromTodayUTC(-10),
    startDate: daysFromTodayUTC(-7),
    dayOfWeek: 6,
    timeSlot: 9,
  });

  const phase = await ensurePhase(tournament.id, "Liga Regular", 1);
  for (const teamId of db.teamIdByName.values()) await ensureEnrollment(tournament.id, teamId, adminId);

  const alreadySeeded = await prisma.match.count({ where: { tournamentId: tournament.id } });
  if (alreadySeeded > 0) {
    db.tournamentIds.pending = tournament.id;
    return;
  }

  const FIXTURES = [
    { home: "Alfa FC", away: "Bravo FC", playedAt: pastMatchDate(3) },
    { home: "Bravo FC", away: "Alfa FC", playedAt: pastMatchDate(1) },
  ];

  for (const f of FIXTURES) {
    const match = await prisma.match.create({
      data: {
        tournamentId: tournament.id,
        phaseId: phase.id,
        homeTeamId: db.teamIdByName.get(f.home)!,
        awayTeamId: db.teamIdByName.get(f.away)!,
        courtId: tournament.courtId,
        scheduledAt: f.playedAt,
        date: dateOnly(f.playedAt),
        timeSlot: tournament.timeSlot,
        status: "SCHEDULED", // ⚠️ fecha pasada + sin MatchResult = pendiente de cargar
      },
    });
    await createCallUps(match.id, f.home as "Alfa FC", f.playedAt, []);
    await createCallUps(match.id, f.away as "Bravo FC", f.playedAt, []);
  }

  db.tournamentIds.pending = tournament.id;
  console.log("✅ Torneo en curso: 2 partidos SCHEDULED con fecha pasada (sin resultado)");
}async function seedAggregatedStats() {
  const finishedId = db.tournamentIds.finished!;

  // ── PlayerStats desde los MatchPlayerStat reales ──
  const stats = await prisma.matchPlayerStat.findMany({
    where: { match: { tournamentId: finishedId } },
    include: { match: { select: { scheduledAt: true, createdAt: true } } },
  });
  const byPlayer = new Map<string, typeof stats>();
  for (const s of stats) {
    const arr = byPlayer.get(s.playerId) ?? [];
    arr.push(s);
    byPlayer.set(s.playerId, arr);
  }

  for (const p of await prisma.player.findMany({ select: { id: true } })) {
    const rows = (byPlayer.get(p.id) ?? []).sort(
      (a, b) =>
        (b.match.scheduledAt ?? b.match.createdAt).getTime() -
        (a.match.scheduledAt ?? a.match.createdAt).getTime()
    );
    const last10 = rows.slice(0, 10);
    const sum = (fn: (r: (typeof last10)[number]) => number) => last10.reduce((acc, r) => acc + fn(r), 0);
    const totalGoals = rows.reduce((acc, r) => acc + r.goals, 0);
    const fairPlay = Math.max(
      0,
      100 - sum((r) => r.yellowCards * 4 + r.blueCards * 8 + r.redCards * 15 + r.fouls)
    );
    const payload = {
      matchesWithStats: rows.length,
      totalGoals,
      avgGoalsLast10: last10.length ? sum((r) => r.goals) / last10.length : 0,
      totalBlueCardsLast10: sum((r) => r.blueCards),
      totalYellowCardsLast10: sum((r) => r.yellowCards),
      totalRedCardsLast10: sum((r) => r.redCards),
      totalFoulsLast10: sum((r) => r.fouls),
      fairPlayScore: fairPlay,
      lastCalculatedAt: new Date(),
    };
    await prisma.playerStats.upsert({ where: { playerId: p.id }, update: payload, create: { playerId: p.id, ...payload } });
  }

  // ── TeamStats ──
  const results = await prisma.matchResult.findMany({
    where: { match: { tournamentId: finishedId } },
    include: { match: { select: { homeTeamId: true, awayTeamId: true } } },
  });
  for (const teamId of db.teamIdByName.values()) {
    let played = 0, won = 0, drawn = 0, lost = 0, gf = 0, ga = 0;
    for (const r of results) {
      const isHome = r.match.homeTeamId === teamId;
      const isAway = r.match.awayTeamId === teamId;
      if (!isHome && !isAway) continue;
      const scored = isHome ? r.homeScore : r.awayScore;
      const conceded = isHome ? r.awayScore : r.homeScore;
      played++; gf += scored; ga += conceded;
      if (scored > conceded) won++;
      else if (scored === conceded) drawn++;
      else lost++;
    }
    const payload = {
      matchesPlayed: played, matchesWon: won, matchesDrawn: drawn, matchesLost: lost,
      goalsFor: gf, goalsAgainst: ga, goalDifference: gf - ga, lastCalculatedAt: new Date(),
    };
    await prisma.teamStats.upsert({ where: { teamId }, update: payload, create: { teamId, ...payload } });
  }

  // ── TournamentStanding ──
  const table: { teamId: string; p: number; w: number; d: number; l: number; gf: number; ga: number; gd: number; pts: number }[] = [];
  for (const teamId of db.teamIdByName.values()) {
    const ts = await prisma.teamStats.findUnique({ where: { teamId } });
    if (!ts) continue;
    table.push({
      teamId, p: ts.matchesPlayed, w: ts.matchesWon, d: ts.matchesDrawn, l: ts.matchesLost,
      gf: ts.goalsFor, ga: ts.goalsAgainst, gd: ts.goalDifference, pts: ts.matchesWon * 3 + ts.matchesDrawn,
    });
  }
  table.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);

    for (let i = 0; i < table.length; i++) {
    const t = table[i];
    if (!t) continue; // guarda de tipos (noUncheckedIndexedAccess); inalcanzable en runtime
    const payload = {
      position: i + 1, matchesPlayed: t.p, matchesWon: t.w, matchesDrawn: t.d, matchesLost: t.l,
      goalsFor: t.gf, goalsAgainst: t.ga, goalDifference: t.gd, points: t.pts, updatedAt: new Date(),
    };
    await prisma.tournamentStanding.upsert({
      where: { tournamentId_teamId: { tournamentId: finishedId, teamId: t.teamId } },
      update: payload,
      create: { tournamentId: finishedId, teamId: t.teamId, ...payload },
    });
  }
  console.log("✅ Estadísticas: PlayerStats (30), TeamStats (2), Standing (2)");
}async function seedFase1() {
  const gestorId = db.userIdByEmail.get("gestor@gestor")!;

  // 1. Delegado: test2 secretario del gestor (valida E3 en front)
  const test2profile = await prisma.profile.findUnique({
    where: { userId: db.userIdByEmail.get("test2@test")! },
    select: { id: true },
  });
  if (test2profile && db.managerId) {
    const delegate = await prisma.managerDelegate.upsert({
      where: { managerId_profileId: { managerId: db.managerId, profileId: test2profile.id } },
      update: {},
      create: { managerId: db.managerId, profileId: test2profile.id, designatedByUserId: gestorId },
    });
    // Delegación v2: test2 con el pack completo (valida secretario total)
    for (const permission of ["match:postpone", "match:reschedule", "match:walkover", "referee:assign", "match:result", "enrollment:manage"]) {
      await prisma.managerDelegatePermission.upsert({
        where: { delegateId_permission: { delegateId: delegate.id, permission } },
        update: {},
        create: { delegateId: delegate.id, permission },
      });
    }
  }

  const inscrip = await prisma.tournament.findFirst({ where: { name: "Copa Test Inscripciones" } });

  // 2. Charlie PENDING_PAYMENT (pasa Factor 1) → Alfa + Charlie = 2 APPROVED = sorteo alcanzable
  if (inscrip) {
    await prisma.tournamentEnrollment.upsert({
      where: { tournamentId_teamId: { tournamentId: inscrip.id, teamId: db.teamIdByName.get("Charlie FC")! } },
      update: { status: "PENDING_PAYMENT" },
      create: { tournamentId: inscrip.id, teamId: db.teamIdByName.get("Charlie FC")!, status: "PENDING_PAYMENT" },
    });

    // 5. Slots multi-franja (principal 6/9 + extras 4/9 y 6/7)
    for (const [dow, slot] of [[4, 9], [6, 7]] as const) {
      await prisma.tournamentSlot.upsert({
        where: { tournamentId_dayOfWeek_timeSlot: { tournamentId: inscrip.id, dayOfWeek: dow, timeSlot: slot } },
        update: {},
        create: { tournamentId: inscrip.id, dayOfWeek: dow, timeSlot: slot },
      });
    }
  }

  // 3b. Torneo dedicado al sorteo QA (APPROVED ×2, SIN fases: closeAndDraw limpio)
  const sorteo = await ensureTournament({
    name: "Copa Test Sorteo",
    description: "Sorteo alcanzable: Alfa + Charlie aprobados, sin bracket previo.",
    status: "SCHEDULED",
    format: "SINGLE_ELIMINATION",
    type: "PUBLIC",
    maxTeams: 8,
    court: { connect: { id: db.courtIdByName.get("Cancha La Villa")! } },
    manager: { connect: { id: db.managerId! } },
    enrollmentDeadline: daysFromTodayUTC(5),
    startDate: daysFromTodayUTC(7),
    dayOfWeek: 6,
    timeSlot: 9,
  });
  for (const teamName of ["Alfa FC", "Charlie FC"]) {
    await prisma.tournamentEnrollment.upsert({
      where: { tournamentId_teamId: { tournamentId: sorteo.id, teamId: db.teamIdByName.get(teamName)! } },
      update: { status: "APPROVED", approvedAt: new Date(), approvedBy: db.managerId! },
      create: { tournamentId: sorteo.id, teamId: db.teamIdByName.get(teamName)!, status: "APPROVED", approvedAt: new Date(), approvedBy: db.managerId! },
    });
  }
  // S06 v3.0: 7 reservas concretas (maxTeams-1), sábados 18:00 desde HOY
  // (la primera cae en la ventana de 7 días de getBubble: azul instantáneo).
  for (let i = 0; i < 7; i++) {
    const d = new Date(daysFromTodayUTC(0).getTime() + i * 7 * 24 * 60 * 60 * 1000);
    await prisma.tournamentSlotReservation.upsert({
      where: {
        tournamentId_date_timeSlot: {
          tournamentId: sorteo.id,
          date: dateOnly(d),
          timeSlot: 9,
        },
      },
      update: {},
      create: {
        tournamentId: sorteo.id,
        courtId: db.courtIdByName.get("Cancha La Villa")!,
        date: dateOnly(d),
        timeSlot: 9,
      },
    });
  }
  console.log("✅ ROJO instantáneo: test1/test2 (Alfa+Charlie en Inscripciones y Sorteo, franja 6/9)");

  // Reservas de publicados (simulan publish): Inscripciones 7 sábados Malcasado.
  if (inscrip) {
    for (let i = 0; i < 7; i++) {
      const d = dateOnly(new Date(daysFromTodayUTC(0).getTime() + i * 7 * 24 * 60 * 60 * 1000));
      await prisma.tournamentSlotReservation.upsert({
        where: { tournamentId_date_timeSlot: { tournamentId: inscrip.id, date: d, timeSlot: 9 } },
        update: {},
        create: { tournamentId: inscrip.id, courtId: db.courtIdByName.get("Cancha Malcasado")!, date: d, timeSlot: 9 },
      });
    }
  }
  // Privada 3 jueves El Sol (dayOfWeek 4, slot 8; próximo jueves desde hoy sábado = +5).
  const priv = await ensureTournament({
    name: "Copa Privada Gestor",
    description: "Solo equipos invitados.",
    status: "SCHEDULED",
    format: "SINGLE_ELIMINATION",
    type: "PRIVATE",
    maxTeams: 4,
    court: { connect: { id: db.courtIdByName.get("Cancha El Sol")! } },
    manager: { connect: { id: db.managerId! } },
    enrollmentDeadline: daysFromTodayUTC(6),
    startDate: daysFromTodayUTC(9),
    dayOfWeek: 4,
    timeSlot: 8,
  });
  await prisma.tournamentTeamInvite.upsert({
    where: { tournamentId_teamId: { tournamentId: priv.id, teamId: db.teamIdByName.get("Delta FC")! } },
    update: { status: "PENDING" },
    create: { tournamentId: priv.id, teamId: db.teamIdByName.get("Delta FC")!, invitedByUserId: gestorId, status: "PENDING" },
  });
  // Privada 3 jueves El Sol (dayOfWeek 4, slot 8; próximo jueves desde hoy sábado = +5).
  for (let i = 0; i < 3; i++) {
    const d = dateOnly(new Date(daysFromTodayUTC(5).getTime() + i * 7 * 24 * 60 * 60 * 1000));
    await prisma.tournamentSlotReservation.upsert({
      where: { tournamentId_date_timeSlot: { tournamentId: priv.id, date: d, timeSlot: 8 } },
      update: {},
      create: { tournamentId: priv.id, courtId: db.courtIdByName.get("Cancha El Sol")!, date: d, timeSlot: 8 },
    });
  }

  // 6. Árbitros extra (valida assignReferee con opciones)
  for (const name of ["Árbitra Nury", "Árbitro Sogamoso"]) {
    const found = await prisma.referee.findFirst({ where: { name } });
    if (!found) await prisma.referee.create({ data: { name } });
  }

  // Invite privado a Delta: notificación al capitán aunque la bandeja ya exista
  const privInvite = await prisma.tournamentTeamInvite.findUnique({
    where: { tournamentId_teamId: { tournamentId: priv.id, teamId: db.teamIdByName.get("Delta FC")! } },
  });
  if (privInvite) {
    const exists = await prisma.notification.findFirst({
      where: { userId: db.userIdByEmail.get("test13@test")!, type: "TOURNAMENT_PUBLISHED", title: "Torneo privado: te invitaron" },
    });
    if (!exists) {
      await prisma.notification.create({
        data: {
          userId: db.userIdByEmail.get("test13@test")!,
          family: "TOURNAMENT",
          type: "TOURNAMENT_PUBLISHED",
          title: "Torneo privado: te invitaron",
          body: "Copa Privada Gestor invita a Delta FC. Revísala en Invitaciones.",
          payload: { tournamentId: priv.id, teamId: db.teamIdByName.get("Delta FC")! },
        },
      });
    }
  }
  if ((await prisma.notification.count()) === 0) {
    const pendingId = db.tournamentIds.pending!;
    const someMatch = await prisma.match.findFirst({ where: { tournamentId: pendingId } });
    const N = async (userId: string, family: "TEAM" | "TOURNAMENT" | "MATCH" | "RECRUITMENT", type: "INVITATION_RECEIVED" | "ENROLLMENT_SUBMITTED" | "ENROLLMENT_APPROVED" | "MATCH_POSTPONED" | "TOURNAMENT_PUBLISHED" | "RECRUITMENT_REQUEST_SENT", title: string, body: string, payload: Record<string, string>) =>
      prisma.notification.create({ data: { userId, family, type, title, body, payload } });
    await N(db.userIdByEmail.get("test13@test")!, "TEAM", "INVITATION_RECEIVED", "Te invitaron a Delta FC", "El capitán te quiere en su equipo", { teamId: db.teamIdByName.get("Delta FC")! });
    await N(gestorId, "TOURNAMENT", "ENROLLMENT_SUBMITTED", "Nueva inscripción", "Bravo FC se inscribió a Copa Test Inscripciones", { tournamentId: inscrip?.id ?? "", teamId: db.teamIdByName.get("Bravo FC")! });
    await N(db.userIdByEmail.get("test1@test")!, "TOURNAMENT", "ENROLLMENT_APPROVED", "Inscripción aprobada", "Alfa FC está en Copa Test Inscripciones", { tournamentId: inscrip?.id ?? "", teamId: db.teamIdByName.get("Alfa FC")! });
    if (someMatch) {
      await N(db.userIdByEmail.get("test1@test")!, "MATCH", "MATCH_POSTPONED", "Partido aplazado", "Tu partido cambió de fecha", { matchId: someMatch.id, tournamentId: pendingId });
    }
    await N(db.userIdByEmail.get("test16@test")!, "TOURNAMENT", "TOURNAMENT_PUBLISHED", "Torneo publicado", "Copa Test Inscripciones abrió inscripciones", { tournamentId: inscrip?.id ?? "" });
    await N(db.userIdByEmail.get("test5@test")!, "RECRUITMENT", "RECRUITMENT_REQUEST_SENT", "Te buscan para un equipo", "Un capitán te envió invitación", { teamId: db.teamIdByName.get("Bravo FC")! });
    console.log("✅ Bandeja Fase 1: 6 notificaciones (6 tipos)");
  }
  console.log("✅ Fase 1: delegado test2 · Charlie PENDING_PAYMENT · Sorteo Alfa+Charlie · privada+invite Delta · slots ×2 · árbitros ×2");
}
async function seedFlujoTournament() {
  // Copa Test Flujo (El Sol): 4 equipos con plantillas distintas, todos
  // AVAILABLE en 6/9, APPROVED, sin fases. Flujo: sortear → SF1/SF2 → final →
  // FINISHED auto + morados. Reservas azules desde hoy.
  const captainRole = await prisma.role.findUnique({ where: { name: "captain" } });
  const defs = [
    { name: "Norte FC", abbr: "NRT", color: "#8B5CF6", members: [1, 2, 3, 4, 5, 6, 7], captain: 3 },
    { name: "Sur FC", abbr: "SUR", color: "#EC4899", members: [8, 9, 10, 11, 12, 18], captain: 9 },
    { name: "Este FC", abbr: "EST", color: "#14B8A6", members: [19, 20, 21, 22, 23, 24], captain: 20 },
    { name: "Oeste FC", abbr: "OES", color: "#F97316", members: [25, 26, 27, 28, 29, 30], captain: 25 },
  ];
  for (const t of defs) {
    const team = await prisma.team.upsert({
      where: { name: t.name },
      update: { status: "ACTIVE" },
      create: {
        name: t.name, abbreviation: t.abbr, primaryColor: t.color, status: "ACTIVE",
        description: `Equipo de flujo. Capitán: test${t.captain}@test`,
      },
    });
    db.teamIdByName.set(t.name, team.id);
    for (const i of t.members) {
      const playerId = db.playerIdByEmail.get(`test${i}@test`)!;
      await prisma.teamMembership.upsert({
        where: { playerId_teamId: { playerId, teamId: team.id } },
        update: { leftAt: null, isCaptain: i === t.captain },
        create: { teamId: team.id, playerId, isCaptain: i === t.captain },
      });
    }
    if (captainRole) {
      const profile = await prisma.profile.findUnique({ where: { userId: db.userIdByEmail.get(`test${t.captain}@test`)! } });
      if (profile) {
        await prisma.roleAssignment.upsert({
          where: { profileId_roleId: { profileId: profile.id, roleId: captainRole.id } },
          update: {},
          create: { profileId: profile.id, roleId: captainRole.id },
        });
      }
    }
  }

  const flujo = await ensureTournament({
    name: "Copa Test Flujo",
    description: "Flujo completo: sorteo → semifinales → final → FINISHED auto. El Sol.",
    status: "SCHEDULED",
    format: "SINGLE_ELIMINATION",
    type: "PUBLIC",
    maxTeams: 4,
    court: { connect: { id: db.courtIdByName.get("Cancha El Sol")! } },
    manager: { connect: { id: db.managerId! } },
    enrollmentDeadline: daysFromTodayUTC(5),
    startDate: daysFromTodayUTC(7),
    dayOfWeek: 6,
    timeSlot: 9,
  });
  for (const t of defs) {
    await prisma.tournamentEnrollment.upsert({
      where: { tournamentId_teamId: { tournamentId: flujo.id, teamId: db.teamIdByName.get(t.name)! } },
      update: { status: "APPROVED", approvedAt: new Date(), approvedBy: db.managerId! },
      create: { tournamentId: flujo.id, teamId: db.teamIdByName.get(t.name)!, status: "APPROVED", approvedAt: new Date(), approvedBy: db.managerId! },
    });
  }
  for (let i = 0; i < 3; i++) {
    const d = dateOnly(new Date(daysFromTodayUTC(0).getTime() + i * 7 * 24 * 60 * 60 * 1000));
    await prisma.tournamentSlotReservation.upsert({
      where: { tournamentId_date_timeSlot: { tournamentId: flujo.id, date: d, timeSlot: 9 } },
      update: {},
      create: { tournamentId: flujo.id, courtId: db.courtIdByName.get("Cancha El Sol")!, date: d, timeSlot: 9 },
    });
  }
  console.log("✅ Copa Test Flujo: 4 equipos APPROVED · 3 reservas El Sol · sin fases (lista para sortear)");
}
async function main() {
  console.log("🌱 Iniciando seed...\n");
  const perms = await seedPermissions();
  await seedRoles();
  await seedRolePermissions(perms);
  await seedUsers();
  await seedCourts();
  await seedTeams();
  await seedFinishedTournament();
  await seedPendingResultsTournament();
  await seedAggregatedStats();
  await seedMatchScreenScenarios();
  await seedInscriptionsTournament();
  await seedFase1();
  await seedFlujoTournament();

  const [users, matches, results, standings] = await Promise.all([
    prisma.user.count(), prisma.match.count(), prisma.matchResult.count(), prisma.tournamentStanding.count(),
  ]);
  console.log(`\n📦 Resumen → usuarios: ${users} · partidos: ${matches} · resultados: ${results} · posiciones: ${standings}`);
  console.log("🌱 Seed completado.");
}
const futureMatchDate = (daysAhead: number) => {
  const d = daysFromTodayUTC(daysAhead);
  d.setUTCHours(23, 0, 0, 0); // 23:00 UTC = 18:00 Bogotá → coincide con la franja al mostrarse
  return d;
};

async function seedInscriptionsTournament() {
  const adminId = db.userIdByEmail.get("admin@admin")!;
  const captainRole = await prisma.role.findUnique({ where: { name: "captain" } });

  const mkTeam = async (name: string, abbr: string, color: string, from: number, to: number, captainIdx: number) => {
    const team = await prisma.team.upsert({
      where: { name },
      update: {},
      create: {
        name, abbreviation: abbr, primaryColor: color, status: "ACTIVE",
        description: `Equipo de prueba. Capitán: test${captainIdx}@test`,
      },
    });
    db.teamIdByName.set(name, team.id);
    for (let i = from; i <= to; i++) {
      const playerId = db.playerIdByEmail.get(`test${i}@test`)!;
      await prisma.teamMembership.upsert({
        where: { playerId_teamId: { playerId, teamId: team.id } },
        update: { leftAt: null, isCaptain: i === captainIdx },
        create: { teamId: team.id, playerId, isCaptain: i === captainIdx },
      });
    }
    if (captainRole) {
      const profile = await prisma.profile.findUnique({ where: { userId: db.userIdByEmail.get(`test${captainIdx}@test`)! } });
      if (profile) {
        await prisma.roleAssignment.upsert({
          where: { profileId_roleId: { profileId: profile.id, roleId: captainRole.id } },
          update: {},
          create: { profileId: profile.id, roleId: captainRole.id },
        });
      }
    }
  };

  // Charlie FC: 7 jugadores DISPONIBLES en la franja → flujo feliz (B → hold → C → PENDING_PAYMENT)
  await mkTeam("Charlie FC", "CHR", "#F59E0B", 2, 8, 2);
  // Delta FC: 5 jugadores SIN disponibilidad día 6 / slot 9 → conflicto (PENDING_AVAILABILITY al confirmar)
  await mkTeam("Delta FC", "DLT", "#EF4444", 13, 17, 13);
  for (const i of [13, 14, 15, 16, 17]) {
    const playerId = db.playerIdByEmail.get(`test${i}@test`)!;
    await prisma.playerAvailability.update({
      where: { playerId_dayOfWeek_timeSlot: { playerId, dayOfWeek: 6, timeSlot: 9 } },
      data: { status: "UNAVAILABLE" },
    });
  }

  const tournament = await ensureTournament({
    name: "Copa Test Inscripciones",
    description: "Inscripciones abiertas (SCHEDULED): CTA, hold de cupo y bracket de eliminación.",
    status: "SCHEDULED",
    format: "SINGLE_ELIMINATION",
    type: "PUBLIC",
    maxTeams: 8,
    court: { connect: { id: db.courtIdByName.get("Cancha Malcasado")! } },
    manager: { connect: { id: db.managerId! } },
    enrollmentDeadline: daysFromTodayUTC(5),
    startDate: daysFromTodayUTC(7),
    dayOfWeek: 6,
    timeSlot: 9,
  });

  // Inscripciones mixtas: Alfa aprobado · Bravo con disponibilidad pendiente (prueba Reevaluar)
  await ensureEnrollment(tournament.id, db.teamIdByName.get("Alfa FC")!, adminId);
  const bravoNote = "Solo 3 jugadores disponibles en la franja del torneo.";
  await prisma.tournamentEnrollment.upsert({
    where: { tournamentId_teamId: { tournamentId: tournament.id, teamId: db.teamIdByName.get("Bravo FC")! } },
    update: { status: "PENDING_AVAILABILITY", availabilityNote: bravoNote },
    create: { tournamentId: tournament.id, teamId: db.teamIdByName.get("Bravo FC")!, status: "PENDING_AVAILABILITY", availabilityNote: bravoNote },
  });
  // Charlie PENDING_PAYMENT + Delta sin inscribir (sus capitanes prueban CTA/reenrollment)

  // Sin bracket previo: las fases/matches fantasma corrompían closeAndDraw
  // y el partido (TBDs). El sorteo QA vive en Copa Test Sorteo.
  console.log("✅ Copa Test Inscripciones: SCHEDULED · Alfa APPROVED · Bravo PENDING_AVAILABILITY · Charlie PENDING_PAYMENT · sin bracket");

  
}
async function seedMatchScreenScenarios() {
  const tournamentId = db.tournamentIds.pending!; // Copa Test En Curso
  const phase = await prisma.tournamentPhase.findFirst({ where: { tournamentId, order: 1 } });
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { courtId: true },
  });
  if (!phase || !tournament) return;

  // Idempotencia: el bloque crea exactamente un POSTPONED; si ya existe, ya corrió
  const already = await prisma.match.findFirst({ where: { tournamentId, status: "POSTPONED" } });
  if (already) return;

  const refereeId = (await prisma.referee.findFirst({ where: { name: "Árbitro Test" } }))?.id;
  const alfa = db.teamIdByName.get("Alfa FC")!;
  const bravo = db.teamIdByName.get("Bravo FC")!;

  // Escenario 1: futuro cercano con convocatoria viva (Capitán B-06a + hero "próximo")
  const upcoming = futureMatchDate(3);
  const upcomingMatch = await prisma.match.create({
    data: {
      tournamentId, phaseId: phase.id,
      homeTeamId: alfa, awayTeamId: bravo,
      courtId: tournament.courtId, refereeId,
      scheduledAt: upcoming, date: dateOnly(upcoming), timeSlot: 9,
      status: "SCHEDULED",
    },
  });
  await createCallUps(upcomingMatch.id, "Alfa FC", upcoming, ["test30@test"]);
  await createCallUps(upcomingMatch.id, "Bravo FC", upcoming, []);

  // Escenario 2: aplazado — fecha original pasada, sin resultado; POSTPONED no es
  // terminal para el engine → el front mantiene árbitro/ausentes/carga vivos
  const original = pastMatchDate(2);
  const postponedMatch = await prisma.match.create({
    data: {
      tournamentId, phaseId: phase.id,
      homeTeamId: bravo, awayTeamId: alfa,
      courtId: tournament.courtId, refereeId,
      scheduledAt: original, date: dateOnly(original), timeSlot: 9,
      status: "POSTPONED",
    },
  });
  await createCallUps(postponedMatch.id, "Alfa FC", original, []);
  await createCallUps(postponedMatch.id, "Bravo FC", original, ["test15@test"]);

  console.log("✅ Escenarios Partido (W4): 1 SCHEDULED futuro + 1 POSTPONED (Copa Test En Curso)");
}
main()
  .catch((e) => { console.error("❌ Error en seed:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });