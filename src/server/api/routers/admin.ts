import { z } from "zod";
import { createTRPCRouter, permissionProcedure, protectedProcedure } from "torneos/server/api/trpc";
import { adminEngine } from "torneos/server/core/admin/admin.engine";
import { securityEngine } from "torneos/server/core/admin/security.engine";

export const adminRouter = createTRPCRouter({
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

  getMyManagerProfile: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.db.manager.findFirst({
        where: {
          profile: { userId: ctx.session.user.id },
          isActive: true,
        },
      });
    }),

  // ==========================================
  // W10 — RBAC runtime (enmiendas aditivas, gateado con permiso nuevo del seed)
  // ==========================================
  getPermissionsMatrix: permissionProcedure("rbac:manage")
    .query(({ ctx }) => securityEngine.getPermissionsMatrix(ctx.db)),

  setRolePermission: permissionProcedure("rbac:manage")
    .input(z.object({
      roleId: z.string(),
      permissionId: z.string(),
      granted: z.boolean(),
    }))
    .mutation(({ ctx, input }) => securityEngine.setRolePermission(ctx.db, input)),

  getUserRoles: permissionProcedure("rbac:manage")
    .input(z.object({ profileId: z.string() }))
    .query(({ ctx, input }) => securityEngine.getUserRoles(ctx.db, input.profileId)),

  assignRole: permissionProcedure("rbac:manage")
    .input(z.object({ profileId: z.string(), roleId: z.string() }))
    .mutation(({ ctx, input }) => securityEngine.assignRole(ctx.db, input)),

  removeRole: permissionProcedure("rbac:manage")
    .input(z.object({ profileId: z.string(), roleId: z.string() }))
    .mutation(({ ctx, input }) =>
      securityEngine.removeRole(ctx.db, input, ctx.session.user.id),
    ),

  createRole: permissionProcedure("rbac:manage")
    .input(z.object({
      name: z.string().min(2).max(50),
      description: z.string().max(200).optional(),
      permissionCodes: z.array(z.string().min(1)).min(1),
    }))
    .mutation(({ ctx, input }) => securityEngine.createRole(ctx.db, input)),

  deleteRole: permissionProcedure("rbac:manage")
    .input(z.object({ roleId: z.string() }))
    .mutation(({ ctx, input }) => securityEngine.deleteRole(ctx.db, input.roleId)),

  // ==========================================
  // W10 — Árbitros (catálogo admin)
  // ==========================================
  listRefereesAdmin: permissionProcedure("referee:manage")
    .query(({ ctx }) => securityEngine.listRefereesAdmin(ctx.db)),

  createReferee: permissionProcedure("referee:manage")
    .input(z.object({
      name: z.string().min(2).max(100),
      phone: z.string().max(30).optional(),
      email: z.string().email().optional(),
    }))
    .mutation(({ ctx, input }) => securityEngine.createReferee(ctx.db, input)),

  updateReferee: permissionProcedure("referee:manage")
    .input(z.object({
      refereeId: z.string(),
      name: z.string().min(2).max(100).optional(),
      phone: z.string().max(30).optional().nullable(),
      email: z.string().email().optional().nullable(),
      isActive: z.boolean().optional(),
    }))
    .mutation(({ ctx, input }) => securityEngine.updateReferee(ctx.db, input)),
});