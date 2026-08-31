import NextAuth from "next-auth";
import { authConfig } from "./config";
import { db } from "torneos/server/db";

export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  events: {
    createUser: async ({ user }) => {
      // 1. Guard Clauses: asegurar que existen id y name
      if (!user.id) return;
      
      // Guardar en una constante para narrowing de tipos automático
      const userId: string = user.id;

      try {
        const playerRole = await db.role.findUnique({
          where: { name: "player" },
        });

        if (!playerRole) {
          console.error("Error crítico: El rol 'player' no existe en la BD.");
          return;
        }

        await db.$transaction(async (tx) => {
          const profile = await tx.profile.create({
            data: {
              userId, // 👈 Se pasa el string ya garantizado
              displayName: user.name ?? "Jugador Anónimo",
            },
          });

          await tx.player.create({
            data: {
              profileId: profile.id,
            },
          });

          await tx.roleAssignment.create({
            data: {
              profileId: profile.id,
              roleId: playerRole.id,
            },
          });
        });

        console.log("✅ RBAC: Profile, Player y Rol asignados a:", user.email);
      } catch (error) {
        console.error("Error en el evento createUser de NextAuth:", error);
      }
    },
  },
});