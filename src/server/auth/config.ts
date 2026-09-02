import { PrismaAdapter } from "@auth/prisma-adapter";
import { type DefaultSession, type NextAuthConfig } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";

import { db } from "torneos/server/db";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      profileId?: string;
      onboarded?: boolean;
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
    // 👇 PROVEEDOR DE DESARROLLO 👇
    ...(process.env.NODE_ENV === "development"
      ? [
          CredentialsProvider({
            name: "Dev Login",
            credentials: {
              email: { label: "Email", type: "email", placeholder: "test@barrio.com" },
            },
            async authorize(credentials) {
              if (!credentials?.email) return null;
              const email = credentials.email as string;

              const user = (await db.user.findUnique({
                where: { email },
                include: { profile: true },
              })) ?? (await db.$transaction(async (tx) => {
                const newUser = await tx.user.create({
                  data: { email, name: email.split("@")[0] },
                  include: { profile: true },
                });

                const playerRole = await tx.role.findUnique({ where: { name: "player" } });
                if (!playerRole) throw new Error("Rol player no encontrado en BD");

                const profile = await tx.profile.create({
                  data: {
                    userId: newUser.id,
                    displayName: newUser.name ?? "Jugador Anónimo",
                    onboarded: true,
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

                return newUser;
              }));

              return {
                id: user.id,
                name: user.profile?.displayName ?? user.name,
                email: user.email,
                image: user.image,
              };
            },
          }),
        ]
      : []),
  ],
  adapter: PrismaAdapter(db),
  session: {
    strategy: "jwt",
  },
  // 👇 CALLBACKS RESTAURADOS Y COMPLETOS 👇
  callbacks: {
    jwt: async ({ token, user, trigger, session }) => {
      if (user) {
        token.id = user.id;
        const profile = await db.profile.findUnique({ where: { userId: user.id } });
        if (profile) {
          token.profileId = profile.id;
          token.onboarded = profile.onboarded;
        }
      }

      if (trigger === "update" && session) {
        const updatePayload = session as { onboarded?: boolean };
        if (typeof updatePayload.onboarded === "boolean") {
          token.onboarded = updatePayload.onboarded;
        }
      }

      return token;
    },
    session: async ({ session, token }) => ({
      ...session,
      user: {
        ...session.user,
        id: token.id as string,
        profileId: token.profileId as string,
        onboarded: token.onboarded as boolean,
      },
    }),
  },
} satisfies NextAuthConfig;