import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";

export const adminEngine = {
  // Buscar usuarios por nombre o email para promocionarlos
  async searchUsers(prisma: PrismaClient, query: string) {
    if (query.length < 3) return [];
    return prisma.profile.findMany({
      where: {
        OR: [
          { displayName: { contains: query, mode: "insensitive" } },
          { user: { email: { contains: query, mode: "insensitive" } } },
        ],
      },
      include: {
        user: { select: { email: true, image: true } },
        roleAssignments: { include: { role: true } },
        manager: true,
      },
      take: 10,
    });
  },

  // Listar todos los gestores actuales
  async listManagers(prisma: PrismaClient) {
    return prisma.manager.findMany({
      include: {
        profile: { 
          include: { 
            user: { select: { email: true } },
            roleAssignments: { include: { role: true } } 
          } 
        },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  // Promocionar usuario a Gestor
  async promoteToManager(prisma: PrismaClient, profileId: string) {
    const profile = await prisma.profile.findUnique({ where: { id: profileId } });
    if (!profile) throw new TRPCError({ code: "NOT_FOUND", message: "Perfil no encontrado" });

    // Buscar el rol del sistema 'manager'
    const managerRole = await prisma.role.findUnique({ where: { name: "manager" } });
    if (!managerRole) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Rol 'manager' no encontrado en BD" });

    return prisma.$transaction(async (tx) => {
      // 1. Crear entidad Manager si no existe
      const manager = await tx.manager.upsert({
        where: { profileId },
        update: { isActive: true },
        create: { profileId, isActive: true },
      });

      // 2. Asignar Rol de Manager si no lo tiene
      await tx.roleAssignment.upsert({
        where: { profileId_roleId: { profileId, roleId: managerRole.id } },
        update: {},
        create: { profileId, roleId: managerRole.id },
      });

      return manager;
    });
  },

  // Activar/Desactivar Gestor
  async toggleManagerStatus(prisma: PrismaClient, managerId: string) {
    const manager = await prisma.manager.findUnique({ where: { id: managerId } });
    if (!manager) throw new TRPCError({ code: "NOT_FOUND", message: "Gestor no encontrado" });

    return prisma.manager.update({
      where: { id: managerId },
      data: { isActive: !manager.isActive },
    });
  }
};