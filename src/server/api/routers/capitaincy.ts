import { z } from "zod";
import { createTRPCRouter, protectedProcedure, permissionProcedure } from "torneos/server/api/trpc";
import { captaincyEngine } from "torneos/server/core/rbac/captaincy.engine";

export const captaincyRouter = createTRPCRouter({
  // Iniciar transferencia de capitanía (Requiere permiso de gestionar equipo)
  requestTransfer: permissionProcedure("team:manage")
    .input(z.object({
      teamId: z.string(),
      toPlayerId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      return captaincyEngine.requestTransfer(ctx.db, input, ctx.session.user.id);
    }),

  // Aceptar transferencia (Requiere sesión, validación de destinatario en el engine)
  acceptTransfer: protectedProcedure
    .input(z.object({ transferId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return captaincyEngine.acceptTransfer(ctx.db, input.transferId, ctx.session.user.id);
    }),

  // Rechazar transferencia
  rejectTransfer: protectedProcedure
    .input(z.object({ transferId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return captaincyEngine.rejectTransfer(ctx.db, input.transferId, ctx.session.user.id);
    }),

  // Obtener transferencias pendientes para el usuario actual
  getPendingTransfers: protectedProcedure.query(async ({ ctx }) => {
    return captaincyEngine.getPendingForPlayer(ctx.db, ctx.session.user.id);
  }),
});