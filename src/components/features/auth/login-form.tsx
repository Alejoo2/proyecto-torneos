"use client";
import { useSearchParams } from "next/navigation";
import {
  isSafeInternalPath,
  DEFAULT_AUTHENTICATED_PATH,
} from "torneos/lib/anon-access";
import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { signIn } from "next-auth/react";
import { OAuthButton } from "torneos/components/ui/oauth-button/oauth-button";
import { Toast } from "torneos/components/ui/toast";

interface LoginFormProps {
  /** Error de callback OAuth reportado por NextAuth en la URL (?error=…). */
  authError?: string;
}

export function LoginForm({ authError }: LoginFormProps) {
  const searchParams = useSearchParams();
  const [authLoading, setAuthLoading] = useState<"google" | "discord" | null>(null);
  const [toast, setToast] = useState<{ title: string } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleOAuth = async (provider: "google" | "discord") => {
    setAuthLoading(provider);

    const requested = searchParams.get("callbackUrl");
    const callbackUrl = isSafeInternalPath(requested)
      ? requested
      : DEFAULT_AUTHENTICATED_PATH;

    // NextAuth gestiona la redirección.
    await signIn(provider, { callbackUrl });

    // Si llega aquí, el flujo no redirigió (falla o cancelación).
    setAuthLoading(null);
    setToast({ title: "No se pudo iniciar sesión — intenta de nuevo" });
  };

  return (
    <main className="relative flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-10">
      {/* HERO — marca púrpura (4.2: identidad, tamaño grande, legal) */}
      <div className="mb-10 flex flex-col items-center text-center">
        <span className="text-4xl font-black uppercase tracking-tight text-cypher-1">Torneos</span>
        <p className="mt-2 text-sm text-cypher-4-2">Encuentra cancha, arma tu equipo, juega.</p>
      </div>

      {/* ACCESO */}
      <div className="w-full max-w-sm space-y-3">
        <OAuthButton
          provider="google"
          onClick={() => void handleOAuth("google")}
          isLoading={authLoading === "google"}
          disabled={authLoading !== null}
        >
          {authLoading === "google" ? "Conectando…" : "Continuar con Google"}
        </OAuthButton>

        <OAuthButton
          provider="discord"
          onClick={() => void handleOAuth("discord")}
          isLoading={authLoading === "discord"}
          disabled={authLoading !== null}
        >
          {authLoading === "discord" ? "Conectando…" : "Continuar con Discord"}
        </OAuthButton>
      </div>

      {/* Error de callback anterior — inline y honesto */}
      {authError && (
        <p role="alert" className="mt-4 max-w-sm text-center text-sm text-red-400">
          {authError}
        </p>
      )}

      {/* OVERLAW DE CONEXIÓN (secuencia → Motion) */}
      <AnimatePresence>
        {authLoading && (
          <motion.div
            className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-cypher-5/95 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <span className="text-sm font-bold uppercase tracking-widest text-cypher-4">
              Conectando con {authLoading === "google" ? "Google" : "Discord"}…
            </span>
            <div className="h-1 w-48 overflow-hidden rounded-full bg-cypher-5-1-1">
              <motion.div
                className="h-full w-1/2 rounded-full bg-cypher-2"
                animate={{ x: ["-100%", "200%"] }}
                transition={{ repeat: Infinity, duration: 1.1, ease: "easeInOut" }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Toast toast={toast} />
    </main>
  );
}