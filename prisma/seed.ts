import { PrismaClient } from "@prisma/client";
import type { User, Profile, Player } from "@prisma/client";

const prisma = new PrismaClient();

interface UserRef {
  user: User;
  profile: Profile;
  player: Player;
}

// ==========================================
// HUB: CANCHAS CON COORDENADAS
// ==========================================
const HUB_COURTS = [
  { name: "Cancha El Sol", address: "Centro, Sogamoso", lat: 5.7184, lon: -72.9321, status: "ENABLED" as const, description: "Cancha de microfútbol con arcos, redes y vestuarios disponibles.", inventory: "Arcos, redes, 4 pelotas, vestuarios" },
  { name: "Cancha La Villa", address: "Parque Principal, Nobsa", lat: 5.7683, lon: -72.8445, status: "ENABLED" as const, description: "Espacio amplio con iluminación nocturna.", inventory: "Arcos, redes, 6 pelotas, bancas" },
  { name: "Cancha Sugamuxi", address: "Barrio San Martín, Sogamoso", lat: 5.7050, lon: -72.9450, status: "DISABLED" as const, description: "Cancha en mantenimiento temporal.", inventory: "Arcos, redes (mantenimiento)" },
  { name: "Cancha Malcasado", address: "Vía a Belén, Nobsa", lat: 5.7550, lon: -72.8600, status: "ENABLED" as const, description: "Cancha comunitaria recién inaugurada.", inventory: "Arcos, redes, 2 pelotas" },
];

/** Franjas abiertas: 12:00–22:00 → slots 6,7,8,9,10 (celdas de 2h) */
const OPEN_SLOTS = [6, 7, 8, 9, 10];

async function seedHub() {
  console.log("Creando canchas del Hub...");

  for (const court of HUB_COURTS) {
    await prisma.court.upsert({
      where: { name: court.name },
      update: { lat: court.lat, lon: court.lon, status: court.status },
      create: court,
    });
  }

  // Limpia disponibilidad vencida para que el seed no acumule registros viejos
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  await prisma.courtAvailability.deleteMany({
    where: { date: { lt: today } },
  });

  // Abre franjas para TODAS las canchas (incluidas las creadas vía admin)
  const courts = await prisma.court.findMany({ select: { id: true, name: true, lat: true, lon: true } });

  for (const court of courts) {
    for (let d = 0; d < 7; d++) {
      const date = new Date(today);
      date.setUTCDate(today.getUTCDate() + d);

      for (const timeSlot of OPEN_SLOTS) {
        await prisma.courtAvailability.upsert({
          where: { courtId_date_timeSlot: { courtId: court.id, date, timeSlot } },
          update: { status: "AVAILABLE" },
          create: { courtId: court.id, date, timeSlot, status: "AVAILABLE" },
        });
      }
    }
  }

  // Aviso visible si alguna cancha quedó sin coordenadas (no aparecerá en el mapa)
  const sinCoordenadas = courts.filter((c) => c.lat === 0 && c.lon === 0);
  if (sinCoordenadas.length > 0) {
    console.warn(
      `⚠️  Canchas sin coordenadas (no se pintan en el mapa): ${sinCoordenadas.map((c) => c.name).join(", ")}`,
    );
  }

  console.log(`✅ Hub: ${courts.length} canchas listas con disponibilidad de 7 días`);
}

async function main() {
  console.log("Iniciando el seed de Roles, Permisos y Datos de Prueba...");

  // ==========================================
  // 1. CREAR ROLES Y PERMISOS BASE
  // ==========================================
  const rolesData = [
    { name: "admin", description: "Administrador global.", isSystem: true },
    { name: "manager", description: "Gestor de torneos.", isSystem: true },
    { name: "player", description: "Jugador base.", isSystem: true },
    { name: "captain", description: "Capitán de equipo.", isSystem: true },
  ];

  for (const role of rolesData) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: role,
    });
  }

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
  ];

  await prisma.permission.createMany({
    data: permissionsData,
    skipDuplicates: true,
  });

  const [dbRoles, dbPermissions] = await Promise.all([
    prisma.role.findMany(),
    prisma.permission.findMany(),
  ]);

  const roles = Object.fromEntries(dbRoles.map((r) => [r.name, r.id]));
  const perms = Object.fromEntries(dbPermissions.map((p) => [p.code, p.id]));

  const rolePermissionsMap: Record<string, string[]> = {
    admin: ["user:manage", "manager:create", "manager:disable", "court:create", "court:edit", "court:disable", "court:view", "tournament:approve"],
    manager: ["court:view", "tournament:create", "tournament:manage", "match:postpone", "match:result"],
    player: ["court:view"],
    captain: ["court:view", "team:invite", "team:manage"],
  };

  const rolePermissionsData = Object.entries(rolePermissionsMap).flatMap(
    ([roleName, permCodes]) =>
      permCodes.map((code) => ({
        roleId: roles[roleName]!,
        permissionId: perms[code]!,
      }))
  );

  await prisma.rolePermission.createMany({
    data: rolePermissionsData,
    skipDuplicates: true,
  });

  // ==========================================
  // 2. CREACIÓN DE USUARIOS DE PRUEBA (1 al 10)
  // ==========================================
  console.log("Creando usuarios de prueba...");

  const testUsersData = Array.from({ length: 10 }, (_, i) => {
    const num = i + 1;
    return {
      email: `${num}@test`,
      name: `${num}`,
    };
  });

  const createdUsers: Record<string, UserRef> = {};

  for (const u of testUsersData) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name },
      create: {
        email: u.email,
        name: u.name,
      },
    });

    const profile = await prisma.profile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        displayName: `Jugador ${u.name}`,
      },
    });

    const player = await prisma.player.upsert({
      where: { profileId: profile.id },
      update: {},
      create: {
        profileId: profile.id,
      },
    });

    createdUsers[u.email] ??= { user, profile, player };
  }

  // ==========================================
  // 3. CREAR USUARIOS ADMINISTRADOR Y GESTOR (Placeholders)
  // ==========================================
  console.log("Creando usuarios Admin y Manager...");

  await prisma.user.upsert({
    where: { email: "admin@test" },
    update: {},
    create: { email: "admin@test", name: "Admin Test" },
  });

  await prisma.user.upsert({
    where: { email: "manager@test" },
    update: {},
    create: { email: "manager@test", name: "Manager Test" },
  });

  // ==========================================
  // 4. CREAR EQUIPO Y VINCULAR MIEMBROS
  // ==========================================
  console.log("Creando equipo con 1@test como capitán y 2, 3, 4 como miembros...");

  let team = await prisma.team.findFirst({
    where: { name: "Equipo Alfa Test" },
  });

  if (!team) {
    team = await prisma.team.create({
      data: {
        name: "Equipo Alfa Test",
        abbreviation: "EAT",
        primaryColor: "#10B981",
        status: "DRAFT",
      },
    });
  }

  const membersToBind = [
    { email: "1@test", isCaptain: true },
    { email: "2@test", isCaptain: false },
    { email: "3@test", isCaptain: false },
    { email: "4@test", isCaptain: false },
  ];

  for (const member of membersToBind) {
    const userRef = createdUsers[member.email];
    if (!userRef) continue;

    const playerRecord = userRef.player;

    const existingMembership = await prisma.teamMembership.findFirst({
      where: {
        teamId: team.id,
        playerId: playerRecord.id,
      },
    });

    if (!existingMembership) {
      await prisma.teamMembership.create({
        data: {
          teamId: team.id,
          playerId: playerRecord.id,
          isCaptain: member.isCaptain,
        },
      });
    }
  }

  // ==========================================
  // 5. HUB: CANCHAS + DISPONIBILIDAD
  // ==========================================
  await seedHub();

  console.log("✅ Seed finalizado correctamente.");
}

main()
  .catch((e) => {
    console.error("❌ Error durante el seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });