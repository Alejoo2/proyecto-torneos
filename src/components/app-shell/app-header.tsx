"use client";

import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cn } from "torneos/lib/utils";
import { useOptionalHeaderTitle } from "torneos/components/app-shell/header-title";
import { BellTrigger } from "torneos/components/app-shell/notification-center";

interface AppHeaderProps {
  mode?: "hub" | "internal";
  /** Título conocido por el RSC (cero flash). Prioridad sobre el contexto (N-4). */
  title?: string;
}

export function AppHeader({ mode, title }: AppHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const ctx = useOptionalHeaderTitle();
  // N-4: prop > contexto. Prop = título conocido por el RSC; contexto = client-side.
  const resolvedTitle = title ?? ctx?.title ?? null;
  const isHub = mode ? mode === "hub" : pathname === "/";

  return (
    <header
      className={cn(
        "pointer-events-none absolute inset-x-0 top-0 z-header grid h-14 grid-cols-[1fr_auto_1fr] items-center gap-2 px-3",
        !isHub && "border-b border-cypher-5-1-1 bg-cypher-5/80 backdrop-blur-md",
      )}
    >
      <div className="flex items-center gap-1">
        {!isHub && (
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Volver"
            className="pointer-events-auto flex size-11 shrink-0 items-center justify-center rounded-full text-cypher-4 transition-colors active:bg-cypher-5-1-1"
          >
            <ArrowLeft className="size-5" />
          </button>
        )}
        {/* Campana SOLO en modo interno. En hub, la integra la search bar.
            El panel vive aquí dentro (NotificationCenter en el layout) y
            ambos triggers abren el mismo panel. */}
        {!isHub && (
          <span className="pointer-events-auto">
            <BellTrigger />
          </span>
        )}
      </div>

      <h1 className={cn("truncate text-sm font-semibold text-cypher-4", (isHub || !resolvedTitle) && "hidden")}>
        {resolvedTitle}
      </h1>
      <div />
    </header>
  );
}