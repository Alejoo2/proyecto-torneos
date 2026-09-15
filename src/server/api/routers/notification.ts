import { z } from "zod";
import { NotificationFamily } from "@prisma/client";
import { createTRPCRouter, protectedProcedure } from "torneos/server/api/trpc";
import { notificationEngine } from "torneos/server/core/notification/notification.engine";

export const notificationRouter = createTRPCRouter({
  list: protectedProcedure.query(({ ctx }) => {
    return notificationEngine.list(ctx.db, ctx.session.user.id);
  }),

  unreadCount: protectedProcedure.query(({ ctx }) => {
    return notificationEngine.unreadCount(ctx.db, ctx.session.user.id);
  }),

  markAsRead: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      return notificationEngine.markAsRead(ctx.db, input.id, ctx.session.user.id);
    }),

  markAllAsRead: protectedProcedure.mutation(({ ctx }) => {
    return notificationEngine.markAllAsRead(ctx.db, ctx.session.user.id);
  }),

  getPreferences: protectedProcedure.query(({ ctx }) => {
    return notificationEngine.getPreferences(ctx.db, ctx.session.user.id);
  }),

  updatePreference: protectedProcedure
    .input(z.object({ family: z.nativeEnum(NotificationFamily), isEnabled: z.boolean() }))
    .mutation(({ ctx, input }) => {
      return notificationEngine.updatePreference(ctx.db, ctx.session.user.id, input.family, input.isEnabled);
    }),
});