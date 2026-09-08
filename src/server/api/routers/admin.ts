import { z } from "zod";
import { createTRPCRouter, permissionProcedure,protectedProcedure  } from "torneos/server/api/trpc";
import { adminEngine } from "torneos/server/core/admin/admin.engine";

export const adminRouter = createTRPCRouter({
  // Solo un admin con permiso 'admin:manage' puede usar este router
  searchUsers: permissionProcedure("user:manage")
    .input(z.object({ query: z.string() }))
    .query(async ({ ctx, input }) => {
      return adminEngine.searchUsers(ctx.db, input.query);
    }),

  listManagers: permissionProcedure("user:manage")
    .query(async ({ ctx }) => {
      return adminEngine.listManagers(ctx.db);
    }),

  promoteToManager: permissionProcedure("manager:create")
    .input(z.object({ profileId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return adminEngine.promoteToManager(ctx.db, input.profileId);
    }),

  toggleManagerStatus: permissionProcedure("manager:disable")
    .input(z.object({ managerId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return adminEngine.toggleManagerStatus(ctx.db, input.managerId);
    }),
      // Añadir esto dentro de adminRouter
  getMyManagerProfile: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.db.manager.findFirst({
        where: { 
          profile: { userId: ctx.session.user.id },
          isActive: true 
        },
      });
    }),
});