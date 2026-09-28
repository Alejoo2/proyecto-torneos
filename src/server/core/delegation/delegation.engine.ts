import { TRPCError } from "@trpc/server";
import { Prisma, type PrismaClient } from "@prisma/client";
import { isDelegable, DELEGABLE_CODES } from "torneos/domain/delegation/permissions";

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
        permissions: { select: { permission: true } },
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
    if (!manager?.isActive) {
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

  /** Delegación v2: el gestor otorga un SUBSET de permisos (llaves de la casa).
   *  Reemplazo total del set, siempre acotado a sus propios delegados. */
  async setPermissions(
    db: PrismaDb,
    input: { managerId: string; delegateId: string; permissions: string[] }
  ) {
    const delegate = await db.managerDelegate.findFirst({
      where: { id: input.delegateId, managerId: input.managerId },
      select: { id: true },
    });
    if (!delegate) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Delegación no encontrada" });
    }
    const clean = [...new Set(input.permissions)].filter((p) => isDelegable(p));
    if (clean.length !== [...new Set(input.permissions)].length) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Permiso no delegable" });
    }
    await db.managerDelegatePermission.deleteMany({ where: { delegateId: delegate.id } });
    if (clean.length > 0) {
      await db.managerDelegatePermission.createMany({
        data: clean.map((permission) => ({ delegateId: delegate.id, permission })),
        skipDuplicates: true,
      });
    }
    return { ok: true, permissions: clean };
  },

  /** ¿userId actúa sobre este torneo como gestor dueño o secretario con `required`?
   *  La casa se valida por tournament.managerId; el actor, por ownership o llave. */
  async getTournamentForManagerAction(
    db: PrismaDb,
    tournamentId: string,
    userId: string,
    required?: string
  ) {
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
      include: { manager: { include: { profile: { select: { userId: true } } } } },
    });
    if (!tournament) throw new TRPCError({ code: "NOT_FOUND", message: "Torneo no encontrado" });
    if (tournament.manager.profile.userId === userId) {
      return { tournament, managerId: tournament.managerId, via: "manager" as const };
    }
    const delegation = await db.managerDelegate.findFirst({
      where: { managerId: tournament.managerId, profile: { userId } },
      select: { id: true },
    });
    if (!delegation) {
      throw new TRPCError({ code: "FORBIDDEN", message: "No eres el gestor de este torneo" });
    }
    if (required) {
      const grant = await db.managerDelegatePermission.findFirst({
        where: { delegateId: delegation.id, permission: required },
        select: { id: true },
      });
      if (!grant) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Tu secretaría no incluye este permiso" });
      }
    }
    return { tournament, managerId: tournament.managerId, via: "delegate" as const };
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

  /** Poderes del usuario sobre un torneo (para UI por permiso, no por rol).
   *  Nunca lanza: sin vínculo devuelve set vacío. El dueño recibe el pack total. */
  async myPowers(db: PrismaDb, tournamentId: string, userId: string) {
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
      select: { managerId: true, manager: { select: { profile: { select: { userId: true } } } } },
    });
    if (!tournament) return { isOwner: false, permissions: [] as string[] };
    if (tournament.manager.profile.userId === userId) {
      return { isOwner: true, permissions: DELEGABLE_CODES };
    }
    const delegation = await db.managerDelegate.findFirst({
      where: { managerId: tournament.managerId, profile: { userId } },
      select: { id: true, permissions: { select: { permission: true } } },
    });
    if (!delegation) return { isOwner: false, permissions: [] as string[] };
    return { isOwner: false, permissions: delegation.permissions.map((p) => p.permission) };
  },
};