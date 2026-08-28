import { PrismaAdapter } from "@auth/prisma-adapter";
import { type DefaultSession, type NextAuthConfig } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import GoogleProvider from "next-auth/providers/google";

import { db } from "torneos/server/db";

/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      // ...other properties
      // role: UserRole;
    } & DefaultSession["user"];
  }

  // interface User {
  //   // ...other properties
  //   // role: UserRole;
  // }
}

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */

export const authConfig = {
  providers: [
    DiscordProvider,
    GoogleProvider({ // <-- AGREGAR ESTO
      authorization: {
        params: {
          prompt: "consent", // Fuerza a Google a pedir consentimiento siempre
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
  ],
  adapter: PrismaAdapter(db),
  callbacks: {
    session: ({ session, user }) => ({
      ...session,
      user: {
        ...session.user,
        id: user.id,
      },
    }),
  },
    // 👇 AQUÍ ESTÁ LA MAGIA DEL RBAC 👇
  events: {
    createUser: async ({ user }) => {
      // 1. Buscamos el rol 'player' que sembramos anteriormente
      const playerRole = await db.role.findUnique({
        where: { name: "player" },
      });

      if (!playerRole) {
        console.error("Error crítico: El rol 'player' no existe en la BD.");
        return; 
      }

      // 2. Usamos una transacción para crear Profile, Player y asignar el rol al mismo tiempo
      // Si una falla, todas fallan (integridad de datos)
      await db.$transaction(async (tx) => {
        // Crear el perfil
        const profile = await tx.profile.create({
          data: {
            userId: user.id,
            displayName: user.name ?? "Jugador Anónimo",
          },
        });

        // Crear la entidad Player
        await tx.player.create({
          data: {
            profileId: profile.id,
          },
        });

        // Asignar el rol de jugador
        await tx.roleAssignment.create({
          data: {
            profileId: profile.id,
            roleId: playerRole.id,
          },
        });
      });
    },
  },
  // 👆 FIN DE LA MAGIA 👆
} satisfies NextAuthConfig;
