import NextAuth from "next-auth";
import { authConfig } from "./config";
import { db } from "torneos/server/db";

// Definimos la forma del objeto cuando se llama a update()
interface UpdateSessionPayload {
  onboarded?: boolean;
}

export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  events: {
    createUser: async ({ user }) => {
      if (!user.id) return;
      const userId: string = user.id;

      try {
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
  callbacks: {
    session: async ({ session, token }) => ({
      ...session,
      user: {
        ...session.user,
        id: token.id as string,
        profileId: token.profileId as string,
        onboarded: token.onboarded as boolean,
      },
    }),
    jwt: async ({ token, user, trigger, session }) => {
      if (user) {
        token.id = user.id;
        const profile = await db.profile.findUnique({ where: { userId: user.id } });
        if (profile) {
          token.profileId = profile.id;
          token.onboarded = profile.onboarded;
        }
      }

      // Casteamos session explícitamente para evitar accesos inseguros según ESLint
      if (trigger === "update" && session) {
        const updatePayload = session as UpdateSessionPayload;
        if (typeof updatePayload.onboarded === "boolean") {
          token.onboarded = updatePayload.onboarded;
        }
      }

      return token;
    },
  },
});