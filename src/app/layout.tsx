import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "torneos/styles/globals.css"; // 👈 Usar tu alias torneos/
import { NextAuthProvider } from "torneos/components/providers/session-provider"; // 👈 Alias y nuevo nombre
import { TRPCReactProvider } from "torneos/trpc/react"; // 👈 Tu alias

const inter = Inter({ subsets: ["latin"] }); // 👈 Cambiar a "latin"

export const metadata: Metadata = {
  title: "Torneos de Barrio",
  description: "Plataforma de gestión de torneos",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="dark">
      <body className={inter.className}>
        <TRPCReactProvider>
          <NextAuthProvider>{children}</NextAuthProvider>
        </TRPCReactProvider>
      </body>
    </html>
  );
}