import { PrismaClient } from "@prisma/client";
import type { Permission } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Iniciando el seed de Roles y Permisos...");

  // 1. CREAR ROLES
  const adminRole = await prisma.role.upsert({
    where: { name: "admin" },
    update: {},
    create: {
      name: "admin",
      description: "Administrador global. Crea canchas, habilita gestores.",
      isSystem: true,
    },
  });

  const managerRole = await prisma.role.upsert({
    where: { name: "manager" },
    update: {},
    create: {
      name: "manager",
      description: "Gestor de torneos. Opera en canchas existentes.",
      isSystem: true,
    },
  });

  const playerRole = await prisma.role.upsert({
    where: { name: "player" },
    update: {},
    create: {
      name: "player",
      description: "Jugador base. Asignado automáticamente al registrarse.",
      isSystem: true,
    },
  });

  const captainRole = await prisma.role.upsert({
    where: { name: "captain" },
    update: {},
    create: {
      name: "captain",
      description: "Capitán de equipo. Permisos de gestión sobre su equipo.",
      isSystem: true,
    },
  });

  console.log("Roles creados:", { adminRole, managerRole, playerRole, captainRole });

  // 2. CREAR PERMISOS
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

  const permissions: Record<string, Permission> = {};
  for (const p of permissionsData) {
    const permission = await prisma.permission.upsert({
      where: { code: p.code },
      update: {},
      create: p,
    });
    permissions[p.code] = permission;
  }

  console.log(`✅ ${permissionsData.length} permisos creados.`);

  // 3. ASIGNAR PERMISOS A ROLES
  const assignPermissionToRole = async (roleId: string, permissionId: string) => {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: { roleId, permissionId },
      },
      update: {},
      create: { roleId, permissionId },
    });
  };

  await Promise.all([
    assignPermissionToRole(adminRole.id, permissions["user:manage"]!.id),
    assignPermissionToRole(adminRole.id, permissions["manager:create"]!.id),
    assignPermissionToRole(adminRole.id, permissions["manager:disable"]!.id),
    assignPermissionToRole(adminRole.id, permissions["court:create"]!.id),
    assignPermissionToRole(adminRole.id, permissions["court:edit"]!.id),
    assignPermissionToRole(adminRole.id, permissions["court:disable"]!.id),
    assignPermissionToRole(adminRole.id, permissions["court:view"]!.id),
    assignPermissionToRole(adminRole.id, permissions["tournament:approve"]!.id),
  ]);

  await Promise.all([
    assignPermissionToRole(managerRole.id, permissions["court:view"]!.id),
    assignPermissionToRole(managerRole.id, permissions["tournament:create"]!.id),
    assignPermissionToRole(managerRole.id, permissions["tournament:manage"]!.id),
    assignPermissionToRole(managerRole.id, permissions["match:postpone"]!.id),
    assignPermissionToRole(managerRole.id, permissions["match:result"]!.id),
  ]);

  await Promise.all([
    assignPermissionToRole(playerRole.id, permissions["court:view"]!.id),
  ]);

  await Promise.all([
    assignPermissionToRole(captainRole.id, permissions["court:view"]!.id),
    assignPermissionToRole(captainRole.id, permissions["team:invite"]!.id),
    assignPermissionToRole(captainRole.id, permissions["team:manage"]!.id),
  ]);

  console.log("✅ Permisos asignados a roles correctamente.");
  console.log("Seed finalizado con éxito.");
}

main()
  .catch((e) => {
    console.error("Error durante el seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });