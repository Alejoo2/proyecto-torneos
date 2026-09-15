import { Prisma, NotificationFamily } from "@prisma/client";
import type { PrismaClient, NotificationType } from "@prisma/client";

type PrismaTx = PrismaClient | Prisma.TransactionClient;

interface CreateNotificationInput {
  userId: string;
  family: NotificationFamily;
  type: NotificationType;
  title: string;
  body: string;
  payload?: Prisma.JsonValue;
}

export const notificationEngine = {
  /**
   * Crea una notificación DENTRO de la transacción activa.
   * Si la transacción principal falla, esta notificación se revierte.
   */
  async create(tx: PrismaTx, input: CreateNotificationInput) {
    // Verificar preferencias del usuario (si tiene desactivada la familia, no se envía)
    const pref = await tx.notificationPreference.findUnique({
      where: { userId_family: { userId: input.userId, family: input.family } },
    });

    if (pref && !pref.isEnabled) return null;

    return tx.notification.create({
      data: {
        userId: input.userId,
        family: input.family,
        type: input.type,
        title: input.title,
        body: input.body,
        payload: input.payload ?? Prisma.JsonNull,
      },
    });
  },

  async list(db: PrismaClient, userId: string) {
    return db.notification.findMany({
      where: { 
        userId,
        // Solo traer notificaciones de familias que el usuario tenga habilitadas
        family: {
          in: (await db.notificationPreference.findMany({
            where: { userId, isEnabled: true },
            select: { family: true }
          })).map(p => p.family)
        }
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  },

  async unreadCount(db: PrismaClient, userId: string) {
    return db.notification.count({
      where: { userId, status: "UNREAD" },
    });
  },

  async markAsRead(db: PrismaClient, notificationId: string, userId: string) {
    return db.notification.updateMany({
      where: { id: notificationId, userId },
      data: { status: "READ", readAt: new Date() },
    });
  },

  async markAllAsRead(db: PrismaClient, userId: string) {
    return db.notification.updateMany({
      where: { userId, status: "UNREAD" },
      data: { status: "READ", readAt: new Date() },
    });
  },

  async getPreferences(db: PrismaClient, userId: string) {
    const families = Object.values(NotificationFamily);
    const existing = await db.notificationPreference.findMany({ where: { userId } });
    
    // Asegurar que devolvemos todas las familias, aunque no tengan registro aún
    return families.map(family => {
      const pref = existing.find(e => e.family === family);
      return {
        userId,
        family,
        isEnabled: pref ? pref.isEnabled : true, // Default true
      };
    });
  },

  async updatePreference(db: PrismaClient, userId: string, family: NotificationFamily, isEnabled: boolean) {
    return db.notificationPreference.upsert({
      where: { userId_family: { userId, family } },
      update: { isEnabled },
      create: { userId, family, isEnabled },
    });
  }
};