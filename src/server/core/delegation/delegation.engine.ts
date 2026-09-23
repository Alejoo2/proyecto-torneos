import { TRPCError } from "@trpc/server";
import { Prisma, type PrismaClient } from "@prisma/client";

type PrismaDb = PrismaClient | Prisma.TransactionClient;

/**
 * W11 — E3: secretarios de gestor (delegación con pack de PARTIDO).
 * El gate de los procedures del pack vive en getMatchForManagerAction (match.engine);
 * aquí solo vive el CRUD de designaciones. Sin notificaciones en v1 (declarado).
 */

export const delegationEngine = {
  /** Búsqueda de perfiles para designar (espejo de admin.searchUsers, gate de gestor). */
  async searchProfiles(db: PrismaDb, query: string) {
    const q = query.trim();
    if (q.length < 3) return [];
    const profiles = await db.profile.findMany({
      where: {
        OR: [
          { displayName: { contains: q, mode: "insensitive" } },
          { user: { name: { contains: q, mode: "insensitive" } } },
          { user: { email: { contains: q, mode: "insensitive" } } },
        ],
      },
      select: {
        id: true,
        displayName: true,
        user: { select: { email: true } },
        manager: { select: { id: true, isActive: true } },
      },
      take: 10,
      orderBy: { displayName: "asc" },
    });
    return profiles.map((p) => ({
      profileId: p.id,
      displayName: p.displayName,
      email: p.user.email,
      isManager: p.manager?.isActive ?? false,
    }));
  },

  async listMyDelegates(db: PrismaDb, managerId: string) {
    return db.managerDelegate.findMany({
      where: { managerId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        profileId: true,
        createdAt: true,
        profile: { select: { displayName: true, user: { select: { email: true } } } },
      },
    });
  },

  async addDelegate(
    db: PrismaDb,
    input: { managerId: string; profileId: string; designatedByUserId: string }
  ) {
    const manager = await db.manager.findUnique({
      where: { id: input.managerId },
      select: { id: true, profileId: true, isActive: true },
    });
    if (!manager || !manager.isActive) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Gestor inexistente o inactivo" });
    }
    if (manager.profileId === input.profileId) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "No puedes designarte a ti mismo" });
    }
    const profile = await db.profile.findUnique({
      where: { id: input.profileId },
      select: { id: true },
    });
    if (!profile) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Perfil no encontrado" });
    }
    try {
      return await db.managerDelegate.create({
        data: {
          managerId: input.managerId,
          profileId: input.profileId,
          designatedByUserId: input.designatedByUserId,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new TRPCError({ code: "CONFLICT", message: "Esta persona ya es secretaria de este gestor" });
      }
      throw e;
    }
  },

  async removeDelegate(db: PrismaDb, input: { managerId: string; delegateId: string }) {
    const removed = await db.managerDelegate.deleteMany({
      where: { id: input.delegateId, managerId: input.managerId },
    });
    if (removed.count === 0) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Delegación no encontrada" });
    }
    return { ok: true };
  },

  /** Superficie del secretario: sus gestores + los torneos de cada uno. */
  async listAssignmentsForProfile(db: PrismaDb, userId: string) {
    const profile = await db.profile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) return [];
    const delegations = await db.managerDelegate.findMany({
      where: { profileId: profile.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        createdAt: true,
        manager: {
          select: {
            id: true,
            isActive: true,
            profile: { select: { displayName: true } },
            tournaments: {
              orderBy: { createdAt: "desc" },
              select: {
                id: true,
                name: true,
                status: true,
                type: true,
                courtId: true,
                dayOfWeek: true,
                timeSlot: true,
              },
            },
          },
        },
      },
    });
    return delegations.map((d) => ({
      delegationId: d.id,
      createdAt: d.createdAt,
      manager: {
        id: d.manager.id,
        isActive: d.manager.isActive,
        displayName: d.manager.profile.displayName,
      },
      tournaments: d.manager.tournaments,
    }));
  },
};