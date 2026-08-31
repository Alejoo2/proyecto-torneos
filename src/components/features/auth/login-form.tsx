"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { OAuthButton } from "torneos/components/ui/oauth-button/oauth-button";

export function LoginForm() {
  const [appLoading, setAppLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState<"google" | "discord" | null>(null);
  const [toast, setToast] = useState<{ title: string; subtitle: string, type: "success" | "info" } | null>(null);

  // Efecto para simular el skeleton inicial de 800ms
  useEffect(() => {
    const timer = setTimeout(() => setAppLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  // Auto-ocultar el toast después de 3s
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleOAuth = async (provider: "google" | "discord") => {
    setAuthLoading(provider);
    
    // NextAuth gestiona la redirección. 
    await signIn(provider, { callbackUrl: "/hub" });
    
    // Si llega aquí, falló o se detuvo. Ocultamos loader.
    setAuthLoading(null);
    setToast({ title: "Error de conexión", subtitle: "Intenta de nuevo", type: "info" });
  };

  return (
    <div className="w-full max-w-lg min-h-100dvh bg-white md:min-h-[90vh] md:my-[5vh] md:rounded-2rem md:border-10px md:border-gray-900 md:shadow-2xl overflow-hidden flex flex-col relative mx-auto">
      
      {/* ESTADO DE CARGA INICIAL (Skeleton) */}
      <div 
        className={`absolute inset-0 z-60 bg-white flex flex-col items-center justify-center transition-opacity duration-500 ${
          appLoading ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="w-24 h-24 bg-gray-200 rounded-3xl mb-6 animate-pulse"></div>
        <div className="h-6 bg-gray-200 rounded w-48 mb-3 animate-pulse"></div>
        <div className="h-3 bg-gray-200 rounded w-64 animate-pulse"></div>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <main className={`flex-1 overflow-y-auto overflow-x-hidden flex flex-col items-center justify-center p-8 relative transition-opacity duration-500 ${appLoading ? "opacity-0" : "opacity-100"}`}>
        
        {/* HERO / BRANDING (Placeholders exactos del mockup) */}
        <div className="flex flex-col items-center mb-12 w-full">
          <div className="w-24 h-24 bg-gray-200 rounded-3xl mb-6 flex items-center justify-center">
            <div className="w-12 h-12 bg-gray-400 rounded-xl"></div>
          </div>
          <div className="h-6 bg-gray-800 rounded w-48 mb-3"></div>
          <div className="h-3 bg-gray-300 rounded w-64"></div>
        </div>

        {/* BOTONES DE AUTENTICACIÓN */}
        <div className="w-full space-y-3">
          <OAuthButton 
            provider="google" 
            onClick={() => handleOAuth("google")}
            isLoading={authLoading === "google"}
            disabled={authLoading !== null}
          >
            {authLoading === "google" ? "Conectando..." : "Continuar con Google"}
          </OAuthButton>

          <OAuthButton 
            provider="discord" 
            onClick={() => handleOAuth("discord")}
            isLoading={authLoading === "discord"}
            disabled={authLoading !== null}
          >
            {authLoading === "discord" ? "Conectando..." : "Continuar con Discord"}
          </OAuthButton>
        </div>

        {/* FOOTER */}
        <div className="mt-8 text-center">
          <div className="h-3 bg-gray-200 rounded w-64 mx-auto"></div>
        </div>

        {/* ESTADO DE CARGA POST-OAUTH (Overlay) */}
        {authLoading && (
          <div className="absolute inset-0 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center gap-4 z-50">
            <div className="w-16 h-16 bg-gray-200 rounded-2xl animate-pulse mb-2"></div>
            <div className="text-gray-600 text-sm font-medium">
              Conectando con {authLoading === "google" ? "Google" : "Discord"}...
            </div>
            {/* Barra de progreso indeterminada usando solo Tailwind */}
            <div className="w-48 h-2 bg-gray-200 rounded-full overflow-hidden mt-4">
              <div className="h-full bg-gray-400 rounded-full animate-pulse w-full"></div>
            </div>
          </div>
        )}
      </main>

      {/* TOAST DE NOTIFICACIÓN */}
      {toast && (
        <div className="absolute top-4 left-4 right-4 z-70 pointer-events-none transition-all duration-300 transform translate-y-0">
          <div className="bg-gray-800 text-white px-4 py-3 rounded-2xl shadow-lg flex items-center gap-3">
            <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white">{toast.title}</div>
              <div className="text-xs text-gray-400">{toast.subtitle}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}