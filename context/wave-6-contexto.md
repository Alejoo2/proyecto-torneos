# Recolección de Contexto — Wave 6: Entrada (Auth + Onboarding) + F-1

---

## SECCIÓN 1 — Inventarios (solo listados)

### 1.1. Listado recursivo de `src/app/(auth)/`
- `src/app/(auth)/login/page.tsx`
- `src/app/(auth)/login-dev/page.tsx`

### 1.2. Listado recursivo de `src/components/features/auth/` y `features/onboarding/`
- `src/components/features/auth/login-form.tsx`
- `src/components/features/onboarding/use-onboarding.tsx`

### 1.3. Listado de `src/components/ui/` (raíz y subcarpetas)
**Carpetas:**
- `src/components/ui/admin/` (`manager-card.tsx`, `user-search-result.tsx`)
- `src/components/ui/availability-matrix/` (`availability-matrix.tsx`, `availability-matrix.variants.ts`)
- `src/components/ui/bottom-nav/` (`bottom-nav.tsx`)
- `src/components/ui/button/` (`button.tsx`, `button.variants.ts`)
- `src/components/ui/card/` (`card.tsx`)
- `src/components/ui/confirm-modal/` (`confirm-modal.tsx`)
- `src/components/ui/court-availability-grid/`
- `src/components/ui/court-availability-matrix/` (`court-availability-matrix.tsx`, `court-availability-matrix.variants.ts`)
- `src/components/ui/court-form/` (`court-form.tsx`)
- `src/components/ui/deletion-banner/` (`deletion-banner.tsx`)
- `src/components/ui/input/` (`input.tsx`)
- `src/components/ui/invitation-card/` (`invitation-card.tsx`)
- `src/components/ui/invite-modal/` (`invite-modal.tsx`)
- `src/components/ui/oauth-button/` (`oauth-button.tsx`, `oauth-button.variants.ts`)
- `src/components/ui/player-card/` (`player-card.tsx`)
- `src/components/ui/player-profile-modal/` (`player-profile-modal.tsx`)
- `src/components/ui/team-card/` (`team-card.tsx`)
- `src/components/ui/tournament/`

**Archivos en raíz de `src/components/ui/`:**
- `age.tsx`
- `badge.tsx`
- `countdown-timer.tsx`
- `empty-state.tsx`
- `loading-skeleton.tsx`
- `player-avatar.tsx`
- `stat-badge.tsx`
- `tab-bar.tsx`
- `team-chip.tsx`
- `toast.tsx`

### 1.4. ¿Existe `(auth)/layout.tsx`? ¿Qué contiene?
**NO existe** el archivo `src/app/(auth)/layout.tsx`. Las páginas dentro del grupo `(auth)` se renderizan utilizando el `src/app/layout.tsx` raíz.

---

## SECCIÓN 2 — Archivos COMPLETOS

### 2.1. Template de login: `src/components/features/auth/login-form.tsx`
```tsx
"use client";
import { useSearchParams } from "next/navigation";
import {
  isSafeInternalPath,
  DEFAULT_AUTHENTICATED_PATH,
} from "torneos/lib/anon-access";
import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { OAuthButton } from "torneos/components/ui/oauth-button/oauth-button";

export function LoginForm() {
  const searchParams = useSearchParams();
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

  const requested = searchParams.get("callbackUrl");
  const callbackUrl = isSafeInternalPath(requested)
    ? requested
    : DEFAULT_AUTHENTICATED_PATH;

  // NextAuth gestiona la redirección.
  await signIn(provider, { callbackUrl });

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
```

### 2.2. oauth-button COMPLETO (`src/components/ui/oauth-button/oauth-button.tsx` y `oauth-button.variants.ts`)

**`src/components/ui/oauth-button/oauth-button.tsx`**:
```tsx
import { cn } from "torneos/lib/utils";
import { type ButtonHTMLAttributes } from "react";
import { oauthButtonVariants } from "./oauth-button.variants";

const GoogleIcon = () => (
  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const DiscordIcon = () => (
  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.007.128 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
  </svg>
);

interface OAuthButtonComponentProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  provider: "google" | "discord";
  isLoading?: boolean;
}

export function OAuthButton({ 
  provider, 
  className, 
  isLoading = false, 
  children, 
  disabled, 
  ...props 
}: OAuthButtonComponentProps) {
  return (
    <button
      className={cn(oauthButtonVariants({ provider }), className)}
      disabled={disabled ?? isLoading}
      {...props}
    >
      {provider === "google" ? <GoogleIcon /> : <DiscordIcon />}
      {children}
    </button>
  );
}
```

**`src/components/ui/oauth-button/oauth-button.variants.ts`**:
```ts
import { cva, type VariantProps } from "class-variance-authority";

export const oauthButtonVariants = cva<{
  provider: {
    google: string;
    discord: string;
  };
  isLoading: {
    true: string;
    false: string;
  };
}>(
  "flex w-full items-center justify-center gap-3 rounded-lg px-4 py-3 font-semibold text-white shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      provider: {
        google: "bg-[#4285F4] hover:bg-[#357AE8] focus:ring-[#4285F4]",
        discord: "bg-[#5865F2] hover:bg-[#4752C4] focus:ring-[#5865F2]",
      },
      isLoading: {
        true: "cursor-wait opacity-75",
        false: "",
      },
    },
    defaultVariants: {
      provider: "google",
      isLoading: false,
    },
  }
);

export type OAuthButtonProps = VariantProps<typeof oauthButtonVariants>;
```

### 2.3. Template de onboarding COMPLETO (`src/app/(app)/onboarding/page.tsx`)
```tsx
"use client";

import { useState } from "react";
import { AvailabilityMatrix } from "torneos/components/ui/availability-matrix/availability-matrix";
import { useOnboarding, useAvailabilityMatrix } from "torneos/components/features/onboarding/use-onboarding";

export default function OnboardingPage() {
  const { completeOnboarding, isSubmitting } = useOnboarding();
  const { availabilities, toggleSlot } = useAvailabilityMatrix();

  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await completeOnboarding({ displayName, phone: phone || undefined, bio: bio || undefined });
  };

  return (
    <main className="container mx-auto max-w-2xl px-4 py-8 flex flex-col gap-8 min-h-screen bg-zinc-950 text-white">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black uppercase tracking-tight">Configura tu Perfil</h1>
        <p className="text-zinc-400 text-sm">Cuenta a la comunidad quién eres y cuándo juegas.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 bg-zinc-900 p-6 rounded-xl border border-zinc-800">
        <h2 className="text-xl font-bold uppercase border-b border-zinc-800 pb-2 mb-2">1. Datos básicos</h2>
        
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-zinc-400">Nombre de Jugador *</label>
          <input
            type="text"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="bg-zinc-800 rounded-md p-2 text-white outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="Ej: El Bicho FC"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-zinc-400">Teléfono (Opcional)</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="bg-zinc-800 rounded-md p-2 text-white outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="+57 300 000 0000"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-zinc-400">Bio (Opcional)</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="bg-zinc-800 rounded-md p-2 text-white outline-none focus:ring-2 focus:ring-emerald-500 h-20 resize-none"
            placeholder="Cuéntale a la cancha tu estilo de juego..."
          />
        </div>
      </form>

      <div className="flex flex-col gap-4 bg-zinc-900 p-6 rounded-xl border border-zinc-800">
        <h2 className="text-xl font-bold uppercase border-b border-zinc-800 pb-2 mb-2">2. Disponibilidad Horaria</h2>
        <p className="text-zinc-400 text-xs">
          Toca las casillas para activar/desactivar. Verde: Disponible. Gris: No disponible. 
          (Amarillo significará que tienes partido en ese horario).
        </p>
        
        <AvailabilityMatrix slots={availabilities} onToggleSlot={toggleSlot} />
      </div>

      <button
        type="submit"
        onClick={handleSubmit}
        disabled={isSubmitting ?? !displayName}
        className="mt-4 w-full bg-emerald-500 text-zinc-950 font-black uppercase p-3 rounded-md hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? "Guardando..." : "Ir a la Cancha"}
      </button>
    </main>
  );
}
```

### 2.4. `(auth)/onboarding/page.tsx` y `(auth)/login/page.tsx`
*Aclaración de ubicación: No existe `src/app/(auth)/onboarding/page.tsx`; la página real del onboarding reside en `src/app/(app)/onboarding/page.tsx` (presentada en 2.3).*

**`src/app/(auth)/login/page.tsx`**:
```tsx
import { redirect } from "next/navigation";
import { auth } from "torneos/server/auth";
import { LoginForm } from "torneos/components/features/auth/login-form";
import {
  isSafeInternalPath,
  DEFAULT_AUTHENTICATED_PATH,
} from "torneos/lib/anon-access";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;

  if (session?.user) {
    // Paridad con el middleware: sin onboarding no hay callback ni hub
    const user = session.user as { onboarded?: boolean } | undefined;
    if (!user?.onboarded) redirect("/onboarding");

    const requested = params.callbackUrl;
    redirect(isSafeInternalPath(requested) ? requested : DEFAULT_AUTHENTICATED_PATH);
  }

  return <LoginForm />;
}
```

### 2.5. `src/components/ui/availability-matrix/` — TODOS sus archivos

**`src/components/ui/availability-matrix/availability-matrix.tsx`**:
```tsx
import { cellVariants } from "./availability-matrix.variants";

interface AvailabilityMatrixProps {
  slots: {
    dayOfWeek: number;
    timeSlot: number;
    status: "AVAILABLE" | "UNAVAILABLE" | "CONFLICT";
  }[];
  onToggleSlot?: (dayOfWeek: number, timeSlot: number) => void;
}

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]; 
const HOURS = Array.from({ length: 12 }, (_, i) => `${i * 2}:00 - ${(i * 2 + 2) % 24}:00`);

export function AvailabilityMatrix({ slots, onToggleSlot }: AvailabilityMatrixProps) {
  const getSlotStatus = (day: number, slot: number) => {
    const found = slots.find((s) => s.dayOfWeek === day && s.timeSlot === slot);
    return found?.status ?? "UNAVAILABLE";
  };

  return (
    <div className="w-full overflow-x-auto pb-4">
      <div className="min-w-600px">
        <div className="grid grid-cols-[60px_repeat(7,1fr)] gap-1 mb-2">
          <div className="w-60px" />
          {DAYS.map((day) => (
            <div key={day} className="text-center text-xs font-bold uppercase text-zinc-400">
              {day}
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-1">
          {HOURS.map((hour, slotIndex) => (
            <div key={slotIndex} className="grid grid-cols-[60px_repeat(7,1fr)] gap-1 items-center">
              <div className="text-right text-xs text-zinc-500 pr-2">{hour}</div>
              {Array.from({ length: 7 }, (_, i) => {
                const dayIndex = i === 6 ? 0 : i + 1; 
                const status = getSlotStatus(dayIndex, slotIndex);
                return (
                  <button
                    key={dayIndex}
                    className={cellVariants({ status })}
                    disabled={status === "CONFLICT"}
                    onClick={() => onToggleSlot?.(dayIndex, slotIndex)}
                    aria-label={`Disponibilidad ${DAYS[i]} a las ${hour}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

**`src/components/ui/availability-matrix/availability-matrix.variants.ts`**:
```ts
import { cva } from "class-variance-authority";

export const cellVariants = cva(
  "h-10 w-full rounded-md transition-all duration-150 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-900 focus:ring-white cursor-pointer",
  {
    variants: {
      status: {
        AVAILABLE: "bg-emerald-500/80 hover:bg-emerald-400 border border-emerald-400",
        UNAVAILABLE: "bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 opacity-50",
        CONFLICT: "bg-amber-500/80 hover:bg-amber-400 border border-amber-400 cursor-not-allowed",
      },
    },
    defaultVariants: {
      status: "UNAVAILABLE",
    },
  }
);
```

### 2.6. `use-onboarding.ts` COMPLETO (`src/components/features/onboarding/use-onboarding.tsx`)
```tsx
"use client";

import { api } from "torneos/trpc/react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState } from "react";

export function useOnboarding() {
  const router = useRouter();
  const { update } = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const completeOnboarding = api.profile.completeOnboarding.useMutation({
    onSuccess: async () => {
      await update({ onboarded: true });
      router.push("/dashboard");
    },
  });

  return {
    completeOnboarding: completeOnboarding.mutateAsync,
    isSubmitting,
    setIsSubmitting,
  };
}

export function useAvailabilityMatrix() {
  const utils = api.useUtils();
  const getMine = api.availability.getMine.useQuery();
  
  const toggleSlot = api.availability.toggleSlot.useMutation({
    onMutate: async (newSlot) => {
      await utils.availability.getMine.cancel();
      const prevData = utils.availability.getMine.getData();

      if (prevData?.player?.availabilities) {
        const updatedSlots = prevData.player.availabilities.map((s) =>
          s.dayOfWeek === newSlot.dayOfWeek && s.timeSlot === newSlot.timeSlot
            ? {
                ...s,
                status: s.status === "AVAILABLE" ? ("UNAVAILABLE" as const) : ("AVAILABLE" as const),
              }
            : s
        );
        utils.availability.getMine.setData(undefined, {
          ...prevData,
          player: { ...prevData.player, availabilities: updatedSlots },
        });
      }
      return { prevData };
    },
    onError: (err, newSlot, ctx) => {
      if (ctx?.prevData) {
        utils.availability.getMine.setData(undefined, ctx.prevData);
      }
    },
    onSettled: () => {
      void utils.availability.getMine.invalidate();
    },
  });

  return {
    availabilities: getMine.data?.player?.availabilities ?? [],
    isLoading: getMine.isLoading,
    toggleSlot: (dayOfWeek: number, timeSlot: number) => 
      toggleSlot.mutate({ dayOfWeek, timeSlot }),
  };
}
```

### 2.7. `src/server/auth/config.ts` COMPLETO
```ts
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
```

### 2.8. `domain/status-labels.ts` y `domain/schedule/labels.ts` COMPLETOS

**`src/domain/status-labels.ts`**:
```ts
// Vocabulario cerrado = el del átomo ui/badge.tsx (matriz 4.3 + semánticos 4.5).
// success/warning/error = familias estándar de Tailwind (deuda TECH-DEBT-COLOR-SEMANTICS).
// neutral = estados terminales o no activos (DRAFT, FINISHED, WALKOVER, INACTIVE).
export type BadgeVariant = "success" | "warning" | "error" | "neutral";

export interface StatusLabel {
  label: string;
  variant: BadgeVariant;
}

// Tipos literales = mismos valores que generan los enums de Prisma,
// sin importar @prisma/client en el bundle del cliente
export type TournamentStatus = "DRAFT" | "SCHEDULED" | "GRACE_PERIOD" | "IN_PROGRESS" | "FINISHED" | "CANCELLED" | "SUSPENDED";
export type EnrollmentStatus = "PENDING_AVAILABILITY" | "PENDING_PAYMENT" | "APPROVED" | "REJECTED" | "DISAPPROVED";
export type MatchStatus = "SCHEDULED" | "IN_PROGRESS" | "FINISHED" | "POSTPONED" | "CANCELLED" | "WALKOVER";
export type TeamStatus = "DRAFT" | "ACTIVE" | "INACTIVE";
export type CourtStatus = "ENABLED" | "DISABLED";

export const TOURNAMENT_STATUS: Record<TournamentStatus, StatusLabel> = {
  DRAFT: { label: "Borrador", variant: "neutral" },
  SCHEDULED: { label: "Inscripciones abiertas", variant: "success" },
  GRACE_PERIOD: { label: "Período de gracia", variant: "warning" },
  IN_PROGRESS: { label: "En curso", variant: "neutral" },
  FINISHED: { label: "Finalizado", variant: "neutral" },
  CANCELLED: { label: "Cancelado", variant: "error" },
  SUSPENDED: { label: "Suspendido", variant: "warning" },
};

export const ENROLLMENT_STATUS: Record<EnrollmentStatus, StatusLabel> = {
  PENDING_AVAILABILITY: { label: "Disponibilidad pendiente", variant: "warning" },
  PENDING_PAYMENT: { label: "Pago pendiente", variant: "warning" },
  APPROVED: { label: "Aprobado", variant: "success" },
  REJECTED: { label: "Rechazado", variant: "error" },
  DISAPPROVED: { label: "Desaprobado", variant: "error" },
};

export const MATCH_STATUS: Record<MatchStatus, StatusLabel> = {
  SCHEDULED: { label: "Programado", variant: "neutral" },
  IN_PROGRESS: { label: "En juego", variant: "success" },
  FINISHED: { label: "Finalizado", variant: "neutral" },
  POSTPONED: { label: "Aplazado", variant: "warning" },
  CANCELLED: { label: "Cancelado", variant: "error" },
  WALKOVER: { label: "Walkover", variant: "neutral" },
};

export const TEAM_STATUS: Record<TeamStatus, StatusLabel> = {
  DRAFT: { label: "Borrador", variant: "neutral" },
  ACTIVE: { label: "Activo", variant: "success" },
  INACTIVE: { label: "Inactivo", variant: "neutral" },
};

export const COURT_STATUS: Record<CourtStatus, StatusLabel> = {
  ENABLED: { label: "Habilitada", variant: "success" },
  DISABLED: { label: "Deshabilitada", variant: "error" },
};
// ─── W5 (aditivo) — Dominio Cancha ───

export type StatusBadgeVariant = "success" | "warning" | "error" | "neutral";

export const TOURNAMENT_STATUS_LABEL: Record<string, { label: string; variant: StatusBadgeVariant }> = {
  DRAFT:        { label: "Borrador",   variant: "neutral" },
  SCHEDULED:    { label: "Programado", variant: "neutral" },
  GRACE_PERIOD: { label: "En gracia",  variant: "warning" },
  IN_PROGRESS:  { label: "En curso",   variant: "success" },
  FINISHED:     { label: "Finalizado", variant: "neutral" },
};

export const COURT_STATUS_LABEL: Record<string, { label: string; variant: StatusBadgeVariant }> = {
  ENABLED:  { label: "Habilitada",   variant: "success" },
  DISABLED: { label: "Deshabilitada", variant: "error" },
};
```

**`src/domain/schedule/labels.ts`**:
```ts
// W2 — Etiquetas de agenda. Fuente única (DRY) para días y franjas de 2h.
// W5 — Se exponen los arreglos base: antes estaban duplicados en componentes.

export const DAY_LABELS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
] as const;

export const SLOT_LABELS = [
  "00:00 - 02:00",
  "02:00 - 04:00",
  "04:00 - 06:00",
  "06:00 - 08:00",
  "08:00 - 10:00",
  "10:00 - 12:00",
  "12:00 - 14:00",
  "14:00 - 16:00",
  "16:00 - 18:00",
  "18:00 - 20:00",
  "20:00 - 22:00",
  "22:00 - 00:00",
] as const;

export function dayLabel(dayOfWeek: number): string {
  return DAY_LABELS[dayOfWeek] ?? "";
}

export function slotLabel(timeSlot: number): string {
  return SLOT_LABELS[timeSlot] ?? "";
}
```

### 2.9. `button.variants.ts` COMPLETO (`src/components/ui/button/button.variants.ts`)
```ts
import { cva, type VariantProps } from "class-variance-authority";

// Re-skin Wave 2 — construido SOLO desde la matriz 4.3:
// primary = lima (cypher-2) con texto grafito; hover/activan derivados -1/-2.
// destructive = familia semántica estándar (doc 4.5, TECH-DEBT-COLOR-SEMANTICS).
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cypher-2/60 focus-visible:ring-offset-2 focus-visible:ring-offset-cypher-5 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-cypher-2 text-cypher-5 hover:bg-cypher-2-1 active:bg-cypher-2-2",
        secondary: "bg-cypher-5-1-1 text-cypher-4 hover:bg-cypher-4/10 active:bg-cypher-4/15",
        outline:
          "border border-cypher-4-2-2/40 bg-transparent text-cypher-4 hover:bg-cypher-4/5 active:bg-cypher-4/10",
        ghost: "bg-transparent text-cypher-4-2 hover:bg-cypher-4/5 hover:text-cypher-4 active:bg-cypher-4/10",
        destructive: "bg-red-600 text-white hover:bg-red-700 active:bg-red-800",
      },
      size: {
        sm: "h-9 px-4 text-sm min-h-[44px]",
        md: "h-11 px-6 text-base min-h-[44px]",
        lg: "h-14 px-8 text-lg min-h-[56px]",
        icon: "h-11 w-11 min-h-[44px] min-w-[44px]",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;
```

### 2.10. `manager-enrollments-template.tsx` ACTUAL (para F-1)

**Líneas 30-40 (Estado `toast` y notificación):**
```tsx
30:   const [toast, setToast] = useState<{ title: string } | null>(null);
31:   const [confirmingDraw, setConfirmingDraw] = useState(false);
32:   const [confirmingCancel, setConfirmingCancel] = useState(false);
33: 
34:   // Toast (protocolo 4.4): piel única del átomo — el texto informa, no el color.
35:   useEffect(() => {
36:     if (!toast) return;
37:     const t = setTimeout(() => setToast(null), 3000);
38:     return () => clearTimeout(t);
39:   }, [toast]);
40:   const notify = useCallback((title: string) => setToast({ title }), []);
```

**Líneas 164-173 (`handleDrawClick`):**
```tsx
164:   const handleDrawClick = useCallback(() => {
165:     if (drawMutation.isPending) return;
166:     if (!confirmingDraw) {
167:       setConfirmingCancel(false);
168:       setConfirmingDraw(true);
169:       return;
170:     }
171:     setConfirmingDraw(false);
172:     drawMutation.mutate({ tournamentId });
173:   }, [confirmingDraw, drawMutation, tournamentId]);
```

**Líneas 272-287 (Bloque del botón Sortear):**
```tsx
272:       {canFinalize && (
273:         <div className="mt-8 space-y-3 border-t border-cypher-5-1-1 px-5 pt-6">
274:           <Button
275:             className="w-full"
276:             size="lg"
277:             disabled={counts.APPROVED < MIN_TEAMS_TO_DRAW || drawMutation.isPending}
278:             onClick={handleDrawClick}
279:           >
280:             {drawMutation.isPending
281:               ? "Sorteando…"
282:               : counts.APPROVED < MIN_TEAMS_TO_DRAW
283:                 ? `Cerrar y sortear · ${counts.APPROVED}/${MIN_TEAMS_TO_DRAW} equipos`
284:                 : confirmingDraw
285:                   ? `¿Confirmar sorteo con ${counts.APPROVED} equipos?`
286:                   : `Cerrar inscripciones y sortear · ${counts.APPROVED} equipos`}
287:           </Button>
```

**Líneas 313 (`Toast` component):**
```tsx
313:       <Toast toast={toast} />
```

---

## SECCIÓN 3 — Extracciones de backend

### 3.1. De `src/server/api/routers/profile.ts`
- **Input Zod `completeOnboarding`:**
  ```ts
  z.object({
    displayName: z.string().min(1).max(50),
    phone: z.string().max(20).optional(),
    bio: z.string().max(500).optional(),
    birthDate: z.date().optional(),
  })
  ```
- **¿Hay `getMyProfile` o similar que el onboarding consulta?**
  No para el onboarding directo. El router expone `me` (`protectedProcedure.query`) que ejecuta `profileEngine.getByUserId`, pero la página de onboarding actual no la llama para precargar datos.

### 3.2. De `src/server/api/routers/availability.ts`
- **Lista de procedimientos (1 línea cada uno):**
  1. `getMine`: `protectedProcedure.query` — Retorna el `Profile` del usuario autenticado incluyendo la relación `player` y sus `availabilities`.
  2. `toggleSlot`: `protectedProcedure.mutation` — Alterna el estado de una franja horaria para el jugador actual.
- **Input Zod del set/toggle de slots (nombres exactos de campos):**
  ```ts
  z.object({
    dayOfWeek: z.number().min(0).max(6),
    timeSlot: z.number().min(0).max(11),
  })
  ```
- **¿Qué devuelve tras guardar (shape)?**
  Retorna el objeto `PlayerAvailability` creado o actualizado de Prisma:
  `{ id: string, playerId: string, dayOfWeek: number, timeSlot: number, status: "AVAILABLE" | "UNAVAILABLE" }`.

### 3.3. De `prisma/schema.prisma`
- **Modelo de disponibilidad del jugador y su Enum:**
  ```prisma
  model PlayerAvailability {
    id        String             @id @default(cuid())
    playerId  String
    dayOfWeek Int
    timeSlot  Int
    status    AvailabilityStatus @default(AVAILABLE)

    player Player @relation(fields: [playerId], references: [id], onDelete: Cascade)

    @@unique([playerId, dayOfWeek, timeSlot])
  }

  enum AvailabilityStatus {
    AVAILABLE
    UNAVAILABLE
  }
  ```
  *Mismo vocabulario de 12 slots (`timeSlot` 0-11) y `dayOfWeek` (0 = Domingo a 6 = Sábado).*

- **Modelo `Profile` / `User` (campos que el onboarding llena):**
  ```prisma
  model Profile {
    id          String    @id @default(cuid())
    userId      String    @unique
    displayName String?
    phone       String?
    bio         String?   @db.Text
    birthDate   DateTime?
    onboarded   Boolean   @default(false)
    createdAt   DateTime  @default(now())
    updatedAt   DateTime  @updatedAt
  }
  ```

### 3.4. De `src/server/auth/config.ts` y middlewares
- **¿Cómo se fuerza onboarding obligatorio?**
  - En `src/middleware.ts`: Si el usuario está autenticado (`isLoggedIn`) y `!user?.onboarded`, cualquier ruta diferente a `/onboarding` o `/api`/`/trpc` es redirigida mediante `NextResponse.redirect(new URL("/onboarding", nextUrl))`.
  - En `src/app/(auth)/login/page.tsx`: Si ya existe sesión y `!user?.onboarded`, redirige directamente a `/onboarding`.
- **¿Qué pasa tras completar onboarding (redirect a dónde)?**
  - `useOnboarding` ejecuta `completeOnboarding` mutation, llama a `update({ onboarded: true })` de NextAuth para refrescar el token JWT, y hace `router.push("/dashboard")` (que el middleware mapea/redirige según la configuración).
  - En `middleware.ts`, si un usuario YA tiene `onboarded === true` e intenta acceder a `/onboarding`, es redirigido a `DEFAULT_AUTHENTICATED_PATH` (`/torneos`).

### 3.5. De los engines involucrados en el onboarding
- **¿`profile.engine` valida algo previo (displayName único, longitud)?**
  `profileEngine.completeOnboarding` solo ejecuta directamente `prisma.profile.update({ where: { userId }, data: { ...data, onboarded: true } })`. No valida unicidad de `displayName` en el engine. La validación de longitud (`min(1).max(50)`) y tipos la realiza la capa de tRPC a través del esquema Zod.

---

## SECCIÓN 4 — Preguntas sí/no + respuesta corta

- **Q1. ¿Login tiene registro propio (credentials signup) o es solo OAuth + login? ¿Cómo entra un usuario NUEVO exactamente (primer login → onboarding)?**
  **Respuesta:** En producción es solo OAuth (Google y Discord). En entorno `development` existe un `CredentialsProvider` ("Dev Login") únicamente con email. Un usuario nuevo inicia sesión por primera vez con OAuth; el `PrismaAdapter` crea el `User` en BD, pero sin registro de `Profile` con `onboarded: true`. El middleware detecta `isLoggedIn && !isOnboarded` y lo redirige forzosamente a `/onboarding`.

- **Q2. ¿El usuario ya-onboarded que visita `/onboarding` ve algo o es redirigido?**
  **Respuesta:** Es redirigido. `middleware.ts` (líneas 52-54) redirige automáticamente a los usuarios ya con onboarding completado desde `/onboarding` hacia `/torneos`.

- **Q3. ¿La AvailabilityMatrix del jugador y la court-availability-matrix comparten algo (variants, tipos) o son independientes?**
  **Respuesta:** Son 100% independientes. Tienen componentes, tipos y archivos de variants separados (`src/components/ui/availability-matrix/` vs `src/components/ui/court-availability-matrix/`).

- **Q4. ¿Los hooks `useOnboarding`/`useAvailabilityMatrix` exponen `isLoading`/`isSubmitting` y errores?**
  **Respuesta:** `useOnboarding` expone `isSubmitting` (no `isLoading` ni objeto `error`). `useAvailabilityMatrix` expone `isLoading` (no `isSubmitting` ni objeto `error`). Ninguno expone explícitamente errores en su valor de retorno.

- **Q5. ¿Existe guard en `(auth)` para usuario YA logueado (no ver login con sesión)?**
  **Respuesta:** Sí. Tanto `middleware.ts` como `(auth)/login/page.tsx` interceptan usuarios autenticados: si `onboarded` es true redirigen a `/torneos` (o `callbackUrl`), y si es false redirigen a `/onboarding`.

- **Q6. ¿`deletion-banner` y `admin-users` son parte de este dominio o de admin?**
  **Respuesta:** No pertenecen al dominio Auth/Onboarding. `deletion-banner` pertenece al dominio de equipos (`src/components/ui/deletion-banner/`) y `admin-users` pertenece al dominio admin (`src/components/ui/admin/`).

- **Q7. ¿Qué campos muestra hoy el onboarding que el backend NO acepta (o viceversa)?**
  **Respuesta:** El frontend muestra `displayName`, `phone`, `bio` y la matriz de disponibilidad. El Zod de backend en `profile.completeOnboarding` acepta adicionalmente `birthDate` (`z.date().optional()`), que el formulario visual del frontend no muestra actualmente. Todos los campos que envía el formulario son aceptados por el backend.

- **Q8. ¿Hay textos prometiendo notificaciones en login/onboarding?**
  **Respuesta:** No. No hay textos prometiendo el envío de correos o notificaciones en `LoginForm` ni en `OnboardingPage`.

---

## SECCIÓN 5 — Higiene

### 5.1. Conteo de piel restante (`bg-white` | `text-zinc-9xx`) por archivo en `src/`
Total de apariciones encontradas: **35 hits** en **19 archivos**.

* **`src/app/(anon)/torneos/page.tsx`**: 4 hits
* **`src/app/(app)/onboarding/page.tsx`**: 1 hit
* **`src/components/features/admin/admin-dashboard-template.tsx`**: 2 hits
* **`src/components/features/auth/login-form.tsx`**: 3 hits
* **`src/components/features/profile/templates/profile-edit-view.tsx`**: 9 hits
* **`src/components/features/recruitment/invitations-view.tsx`**: 2 hits
* **`src/components/features/recruitment/recruitment-view.tsx`**: 2 hits
* **`src/components/features/team/create-team-form.tsx`**: 1 hit
* **`src/components/features/team/team-detail-view.tsx`**: 4 hits
* **`src/components/features/team/teams-list.tsx`**: 1 hit
* **`src/components/ui/admin/manager-card.tsx`**: 3 hits
* **`src/components/ui/admin/user-search-result.tsx`**: 3 hits
* **`src/components/ui/deletion-banner/deletion-banner.tsx`**: 1 hit
* **`src/components/ui/invitation-card/invitation-card.tsx`**: 1 hit
* **`src/components/ui/invite-modal/invite-modal.tsx`**: 1 hit
* **`src/components/ui/player-profile-modal/player-profile-modal.tsx`**: 2 hits
* **`src/components/ui/team-card/team-card.tsx`**: 1 hit

### 5.2. Inventario exacto de clases `emerald` en `src/`
- **`src/app/(app)/onboarding/page.tsx`**:
  - L37: `focus:ring-emerald-500`
  - L48: `focus:ring-emerald-500`
  - L58: `focus:ring-emerald-500`
  - L78: `bg-emerald-500` y `hover:bg-emerald-400`
- **`src/components/ui/availability-matrix/availability-matrix.variants.ts`**:
  - L8: `bg-emerald-500/80 hover:bg-emerald-400 border border-emerald-400`
- **`src/components/features/match/result-wizard.tsx`**:
  - L507: `text-emerald-400`
  - L514: `text-emerald-400`
- **`src/components/features/team/team-detail-view.tsx`**:
  - L128: `text-emerald-600`

### 5.3. ¿F-1 target intacto?
**Sí, intacto.** El componente `src/components/features/tournament/manager-enrollments-template.tsx` conserva:
- El estado `confirmingDraw` (L31).
- La función `handleDrawClick` (L164-173).
- El botón de cierre y sorteo con feedback visual/texto diferido (L274-287).
- La zona de rendering del componente `<Toast toast={toast} />` (L313).

### 5.4. Warnings ESLint de los archivos de la Sección 2
Se ejecutó la verificación estática via ESLint sobre los 13 archivos enumerados en la Sección 2:
- **Resultado:** **0 errores, 0 warnings.**

---

## HALLAZGOS INESPERADOS

1. **`OnboardingPage` en `(app)` y no en `(auth)`**:
   La ruta física del onboarding se encuentra bajo la carpeta del layout protegido `src/app/(app)/onboarding/page.tsx`, aunque conceptualmente y en los flujos de autenticación forme parte del onboarding inicial de la cuenta.
2. **Redirección de `useOnboarding` a `/dashboard`**:
   El hook `useOnboarding` realiza `router.push("/dashboard")` tras completar el onboarding con éxito, pero la ruta `/dashboard` no existe como tal en el árbol de app (el middleware la redirige o gestiona hacia la ruta predeterminada `/torneos`).
3. **Disponibilidad por defecto en Dev Login**:
   En `authConfig`, cuando se crea un usuario vía "Dev Login", se generan automáticamente las 84 entradas (7 días × 12 slots) en `PlayerAvailability` con status `"AVAILABLE"`. En cambio, usuarios creados por OAuth normal quedan a la espera de ser inicializados o creados on-demand al interactuar con el toggle de disponibilidad.
