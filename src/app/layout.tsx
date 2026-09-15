import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "torneos/styles/globals.css";
import { NextAuthProvider } from "torneos/components/providers/session-provider";
import { TRPCReactProvider } from "torneos/trpc/react";

// La fuente entra como variable CSS → alimenta el token --font-sans en @theme.
// Un solo punto de verdad tipográfico (mismo espíritu que los tokens Cypher).
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "Torneos de Barrio",
    template: "%s · Torneos de Barrio",
  },
  description: "Plataforma de gestión de torneos",
};

// OBLIGATORIO viewport-fit=cover: sin él, env(safe-area-inset-bottom) = 0 en iOS
// y la utilidad pb-nav-safe / el padding de la BottomNav no hacen nada (doc 2.1).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#141414", // la barra del navegador móvil se pinta grafito
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={inter.variable}>
      <body>
        <TRPCReactProvider>
          <NextAuthProvider>{children}</NextAuthProvider>
        </TRPCReactProvider>
      </body>
    </html>
  );
}