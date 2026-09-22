import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";

/**
 * W10.1 — RBAC runtime (roles derivados) + Árbitros. Enmiendas ADITIVAS.
 * Filosofía del dueño: los 4 roles del sistema (isSystem) son SOLO LECTURA —
 * jamás se editan ni borran; el admin crea roles personalizados (derivados)
 * con permisos específicos. Salvaguardas del engine (el front jamás ofrece
 * lo que aquí se rechaza):
 * S1: roles isSystem → solo lectura (supersede la salvaguarda puntual de rbac:manage,
 *     que se conserva como defensa en profundidad).
 * S2: nadie se quita a sí mismo el rol admin.
 * S3: debe existir siempre al menos un admin.
 * S4: nombres de rol personalizados jamás colisionan con los de sistema
 *     (esos 4 nombres están referenciados en código: isAdminSession, createDraft,
 *     promoteToManager, eventos de auth).
 * S5: un rol personalizado con usuarios asignados no se borra (primero desasignar).
 * RolePermission no garantiza @@unique compuesto → findFirst defensivo (sin upsert).
 */
const SYSTEM_ROLE_NAMES = ["admin", "manager", "player", "captain"];

export const securityEngine = {
  async getPermissionsMatrix(prisma: PrismaClient) {
    const [roles, permissions] = await Promise.all([
      prisma.role.findMany({
        orderBy: [{ isSystem: "desc" }, { name: "asc" }],
        include: { permissions: { select: { permission: { select: { code: true } } } } },
      }),
      prisma.permission.findMany({ orderBy: [{ module: "asc" }, { code: "asc" }] }),
    ]);
    return {
      roles: roles.map((r) => ({
        id: r.id,
        name: r.name,
        isSystem: r.isSystem,
        permissions: r.permissions.map((rp) => rp.permission.code),
      })),
      permissions: permissions.map((p) => ({ id: p.id, code: p.code, name: p.name, module: p.module })),
    };
  },

  async setRolePermission(
    prisma: PrismaClient,
    input: { roleId: string; permissionId: string; granted: boolean },
  ) {
    const [role, permission] = await Promise.all([
      prisma.role.findUnique({ where: { id: input.roleId } }),
      prisma.permission.findUnique({ where: { id: input.permissionId } }),
    ]);
    if (!role || !permission) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Rol o permiso no encontrado" });
    }
    // S1: los roles del sistema son inmutables desde la consola
    if (role.isSystem) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Los roles del sistema son de solo lectura. Crea un rol personalizado.",
      });
    }
    if (input.granted) {
      const existing = await prisma.rolePermission.findFirst({
        where: { roleId: role.id, permissionId: permission.id },
      });
      if (!existing) {
        await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: permission.id } });
      }
    } else {
      await prisma.rolePermission.deleteMany({ where: { roleId: role.id, permissionId: permission.id } });
    }
    return { roleId: role.id, permissionId: permission.id, granted: input.granted };
  },

  async createRole(
    prisma: PrismaClient,
    input: { name: string; description?: string; permissionCodes: string[] },
  ) {
    const name = input.name.trim();
    if (name.length < 2 || name.length > 50) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "El nombre debe tener entre 2 y 50 caracteres" });
    }
    // S4: colisión con roles de sistema o existentes
    if (SYSTEM_ROLE_NAMES.includes(name.toLowerCase())) {
      throw new TRPCError({ code: "CONFLICT", message: "Ese nombre está reservado para un rol del sistema" });
    }
    const existing = await prisma.role.findUnique({ where: { name } });
    if (existing) {
      throw new TRPCError({ code: "CONFLICT", message: "Ya existe un rol con ese nombre" });
    }

    const permissions = await prisma.permission.findMany({
      where: { code: { in: input.permissionCodes } },
      select: { id: true },
    });
    if (permissions.length !== input.permissionCodes.length) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Uno o más permisos no existen" });
    }

    return prisma.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: { name, description: input.description, isSystem: false },
      });
      if (permissions.length > 0) {
        await tx.rolePermission.createMany({
          data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })),
        });
      }
      return { id: role.id, name: role.name, isSystem: role.isSystem, permissions: input.permissionCodes };
    });
  },

  async deleteRole(prisma: PrismaClient, roleId: string) {
    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new TRPCError({ code: "NOT_FOUND", message: "Rol no encontrado" });
    if (role.isSystem) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Los roles del sistema no se pueden eliminar" });
    }
    // S5: desasignar usuarios primero
    const assignments = await prisma.roleAssignment.count({ where: { roleId } });
    if (assignments > 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `El rol tiene ${assignments} usuario(s) asignado(s). Quítaselos primero.`,
      });
    }
    return prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId } });
      await tx.role.delete({ where: { id: roleId } });
      return { deleted: true };
    });
  },

  async getUserRoles(prisma: PrismaClient, profileId: string) {
    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
      select: {
        id: true,
        displayName: true,
        user: { select: { email: true } },
        roleAssignments: { select: { role: { select: { id: true, name: true, isSystem: true } } } },
      },
    });
    if (!profile) throw new TRPCError({ code: "NOT_FOUND", message: "Perfil no encontrado" });
    return {
      profileId: profile.id,
      displayName: profile.displayName,
      email: profile.user.email,
      roles: profile.roleAssignments.map((ra) => ra.role),
    };
  },

  async assignRole(prisma: PrismaClient, input: { profileId: string; roleId: string }) {
    const [profile, role] = await Promise.all([
      prisma.profile.findUnique({ where: { id: input.profileId }, select: { id: true } }),
      prisma.role.findUnique({ where: { id: input.roleId } }),
    ]);
    if (!profile || !role) throw new TRPCError({ code: "NOT_FOUND", message: "Perfil o rol no encontrado" });
    const existing = await prisma.roleAssignment.findFirst({
      where: { profileId: profile.id, roleId: role.id },
    });
    if (!existing) {
      await prisma.roleAssignment.create({ data: { profileId: profile.id, roleId: role.id } });
    }
    return { profileId: profile.id, roleId: role.id };
  },

  async removeRole(
    prisma: PrismaClient,
    input: { profileId: string; roleId: string },
    actorUserId: string,
  ) {
    const role = await prisma.role.findUnique({ where: { id: input.roleId } });
    if (!role) throw new TRPCError({ code: "NOT_FOUND", message: "Rol no encontrado" });
    const target = await prisma.profile.findUnique({
      where: { id: input.profileId },
      select: { userId: true },
    });
    if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Perfil no encontrado" });
    if (role.name === "admin") {
      if (target.userId === actorUserId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "No puedes quitarte tu propio rol de administrador." });
      }
      const admins = await prisma.roleAssignment.count({ where: { role: { name: "admin" } } });
      if (admins <= 1) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Debe existir al menos un administrador." });
      }
    }
    await prisma.roleAssignment.deleteMany({ where: { profileId: input.profileId, roleId: input.roleId } });
    return { profileId: input.profileId, roleId: input.roleId };
  },

  // ─── Árbitros (sin cambios) ───
  async listRefereesAdmin(prisma: PrismaClient) {
    return prisma.referee.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { matches: true } } },
    });
  },

  async createReferee(prisma: PrismaClient, input: { name: string; phone?: string; email?: string }) {
    return prisma.referee.create({ data: input });
  },

  async updateReferee(
    prisma: PrismaClient,
    input: { refereeId: string; name?: string; phone?: string | null; email?: string | null; isActive?: boolean },
  ) {
    const { refereeId, ...data } = input;
    return prisma.referee.update({ where: { id: refereeId }, data });
  },
};