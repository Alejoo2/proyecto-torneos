import { AppShell } from "torneos/components/app-shell/app-shell";

// Doc 2.2: (auth) = Marco + contenido. Sin barra superior, sin nav, sin campana:
// aquí la sesión está de visita, nada del shell autenticado se monta.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}