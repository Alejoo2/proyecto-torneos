import { redirect } from "next/navigation";
import { auth } from "torneos/server/auth";
import { LoginForm } from "torneos/components/features/auth/login-form";

export default async function LoginPage() {
  const session = await auth();

  // Validación en servidor: Si ya está logueado, ¿para qué mostrarle el login?
  if (session?.user) {
    // Aquí en el futuro validaremos si completó el onboarding (Sistema 2)
    // Para redirigir a /onboarding o /hub
    redirect("/hub"); 
  }

  return <LoginForm />;
}