import { type DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      profileId?: string;
      onboarded?: boolean;
    } & DefaultSession["user"];
  }
}