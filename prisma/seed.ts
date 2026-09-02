import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Iniciando el seed de Roles y Permisos...");

  // 1. CREAR ROLES
  const rolesData = [
    { name: "admin", description: "Administrador global. Crea canchas, habilita gestores.", isSystem: true },
    { name: "manager", description: "Gestor de torneos. Opera en canchas existentes.", isSystem: true },
    { name: "player", description: "Jugador base. Asignado automáticamente al registrarse.", isSystem: true },
    { name: "captain", description: "Capitán de equipo. Permisos de gestión sobre su equipo.", isSystem: true },
  ];

  for (const role of rolesData) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: role,
    });
  }

  // 2. CREAR PERMISOS DE FORMA MASIVA
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

  // Obtener IDs actualizados
  const [dbRoles, dbPermissions] = await Promise.all([
    prisma.role.findMany(),
    prisma.permission.findMany(),
  ]);

  const roles = Object.fromEntries(dbRoles.map((r) => [r.name, r.id]));
  const perms = Object.fromEntries(dbPermissions.map((p) => [p.code, p.id]));

  // 3. MAPEO DE PERMISOS POR ROL
  const rolePermissionsMap: Record<string, string[]> = {
    admin: [
      "user:manage",
      "manager:create",
      "manager:disable",
      "court:create",
      "court:edit",
      "court:disable",
      "court:view",
      "tournament:approve",
    ],
    manager: [
      "court:view",
      "tournament:create",
      "tournament:manage",
      "match:postpone",
      "match:result",
    ],
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

  console.log("✅ Seed finalizado correctamente.");
}

main()
  .catch((e) => {
    console.error("Error durante el seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });