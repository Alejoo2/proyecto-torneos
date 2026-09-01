"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";

// 👈 Renombramos la función a NextAuthProvider
export function NextAuthProvider({ children }: { children: React.ReactNode }) {
  return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>;
}