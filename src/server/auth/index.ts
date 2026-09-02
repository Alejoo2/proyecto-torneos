import NextAuth from "next-auth";
import { authConfig } from "./config";
import { db } from "torneos/server/db";

export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  events: {
    createUser: async ({ user }) => {
      if (!user.id) return;
      const userId: string = user.id;

      try {
        // Verificamos si el perfil ya existe (para evitar duplicados si algo falla)
        const existingProfile = await db.profile.findUnique({ where: { userId } });
        if (existingProfile) return;

        const playerRole = await db.role.findUnique({ where: { name: "player" } });
        if (!playerRole) return;

        await db.$transaction(async (tx) => {
          const profile = await tx.profile.create({
            data: {
              userId,
              displayName: user.name ?? "Jugador Anónimo",
            },
          });

          const availabilitiesData = Array.from({ length: 7 }, (_, day) =>
            Array.from({ length: 12 }, (_, slot) => ({
              dayOfWeek: day,
              timeSlot: slot,
              status: "AVAILABLE" as const,
            }))
          ).flat();

          await tx.player.create({
            data: {
              profileId: profile.id,
              availabilities: { create: availabilitiesData },
            },
          });

          await tx.roleAssignment.create({
            data: { profileId: profile.id, roleId: playerRole.id },
          });
        });
      } catch (error) {
        console.error("Error en createUser:", error);
      }
    },
  },
});