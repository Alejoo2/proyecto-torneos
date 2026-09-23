import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  managerProcedure,
  permissionProcedure,
} from "torneos/server/api/trpc";
import { delegationEngine } from "torneos/server/core/delegation/delegation.engine";

/**
 * W11 — E3: designación de secretarios.
 * · Gestor: searchProfiles/listMine/addMine/removeMine (managerProcedure)
 * · Admin: listForManager/addForManager/removeForManager (gate user:manage — pestaña Gestores)
 * · Secretario: listAssignments (protected) — superficie "mis secretarías"
 */
export const delegationRouter = createTRPCRouter({
  searchProfiles: managerProcedure
    .input(z.object({ query: z.string().trim().min(3).max(60) }))
    .query(({ ctx, input }) => delegationEngine.searchProfiles(ctx.db, input.query)),

  listMine: managerProcedure.query(({ ctx }) => {
    return delegationEngine.listMyDelegates(ctx.db, ctx.manager.id);
  }),

  addMine: managerProcedure
    .input(z.object({ profileId: z.string() }))
    .mutation(({ ctx, input }) => {
      return delegationEngine.addDelegate(ctx.db, {
        managerId: ctx.manager.id,
        profileId: input.profileId,
        designatedByUserId: ctx.session.user.id,
      });
    }),

  removeMine: managerProcedure
    .input(z.object({ delegateId: z.string() }))
    .mutation(({ ctx, input }) => {
      return delegationEngine.removeDelegate(ctx.db, {
        managerId: ctx.manager.id,
        delegateId: input.delegateId,
      });
    }),

  // ─── Consola Admin (pestaña Gestores, gate existente del seed) ───
  listForManager: permissionProcedure("user:manage")
    .input(z.object({ managerId: z.string() }))
    .query(({ ctx, input }) => delegationEngine.listMyDelegates(ctx.db, input.managerId)),

  addForManager: permissionProcedure("user:manage")
    .input(z.object({ managerId: z.string(), profileId: z.string() }))
    .mutation(({ ctx, input }) => {
      return delegationEngine.addDelegate(ctx.db, {
        managerId: input.managerId,
        profileId: input.profileId,
        designatedByUserId: ctx.session.user.id,
      });
    }),

  removeForManager: permissionProcedure("user:manage")
    .input(z.object({ managerId: z.string(), delegateId: z.string() }))
    .mutation(({ ctx, input }) => {
      return delegationEngine.removeDelegate(ctx.db, {
        managerId: input.managerId,
        delegateId: input.delegateId,
      });
    }),

  // ─── Secretario ───
  listAssignments: protectedProcedure.query(({ ctx }) => {
    return delegationEngine.listAssignmentsForProfile(ctx.db, ctx.session.user.id);
  }),
});