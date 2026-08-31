import { PrismaAdapter } from "@auth/prisma-adapter";
import { type DefaultSession, type NextAuthConfig } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import GoogleProvider from "next-auth/providers/google";

import { db } from "torneos/server/db";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

export const authConfig = {
  providers: [
    DiscordProvider,
    GoogleProvider({
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
  ],
  adapter: PrismaAdapter(db),
  // 👇 1. FORZAMOS LA ESTRATEGIA JWT SEGÚN SPEC 4.1
  session: {
    strategy: "jwt",
  },
  callbacks: {
    // 👇 2. ADAPTAMOS LOS CALLBACKS PARA JWT
    jwt: ({ token, user }) => {
      // 'user' solo está disponible la primera vez que el usuario inicia sesión
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    session: ({ session, token }) => ({
      ...session,
      user: {
        ...session.user,
        id: token.id as string, // Mapeamos el id del token a la sesión
      },
    }),
  },
} satisfies NextAuthConfig;