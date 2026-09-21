"use client";

import { useEffect, useRef, useState } from "react";
import { Crown, Shirt } from "lucide-react";
import { PlayerAvatar } from "torneos/components/ui/player-avatar";
import { cn } from "torneos/lib/utils";

interface StarterTileProps {
  name: string;
  image?: string | null;
  /** En cancha (isStarter). Tile bg cypher-3 (idioma "ready" de W4). */
  active?: boolean;
  /** Gate espejo del engine (ej: banco con 5/5). Sin interacción. */
  disabled?: boolean;
  /** Marca informativa de rol (corona, gris informativo — jamás acento). */
  isCaptain?: boolean;
  onToggle: () => void;
}

/** W8.3 — Tile del mosaico Cancha/Banco. Estilo visual de las cells W8.1
 *  (camiseta flotante de estado) + interacción W8.2: el tile ENTERO es el
 *  toggle con doble-toque auto-reset 3000ms (patrón W3): primer tap arma
 *  (camiseta lima), segundo confirma. Acción reversible sin side-effects. */
export function StarterTile({ name, image, active, disabled, isCaptain, onToggle }: StarterTileProps) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const handleTap = () => {
    if (disabled) return;
    if (armed) {
      if (timer.current !== null) window.clearTimeout(timer.current);
      setArmed(false);
      onToggle();
      return;
    }
    setArmed(true);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setArmed(false), 3000);
  };

  return (
    <button
      type="button"
      onClick={handleTap}
      disabled={disabled}
      aria-pressed={!!active}
      aria-label={
        armed
          ? `Confirmar ${active ? "quitar de" : "poner en"} cancha a ${name}`
          : `${active ? "Quitar de" : "Poner en"} cancha: ${name}`
      }
      className={cn(
        "relative flex w-full flex-col items-center gap-1.5 rounded-xl border px-1 py-2 transition-colors",
        "border-cypher-5-1-1",
        active ? "bg-cypher-3" : "bg-cypher-5",
        disabled && "cursor-not-allowed opacity-50",
        !disabled && "active:scale-[0.97]",
      )}
    >
      {isCaptain && (
        <Crown
          className={cn(
            "absolute left-1 top-1 size-3",
            active ? "text-cypher-5" : "text-cypher-4-2",
          )}
          aria-label="Capitán"
        />
      )}
      <PlayerAvatar profile={{ displayName: name, image: image ?? null }} size="sm" />
      <span
        className={cn(
          "w-full truncate text-center text-[9px]",
          active ? "text-cypher-5" : "text-cypher-4-2",
        )}
      >
        {name}
      </span>
      {/* Camiseta de estado (estilo W8.1): lima = confirmando, turquesa = en cancha,
          grafito = banco. Click en ella = click del tile (misma acción). */}
      <span
        aria-hidden="true"
        className={cn(
          "absolute -right-1.5 -top-1.5 flex size-6 items-center justify-center rounded-full border transition-colors",
          armed
            ? "border-cypher-2 bg-cypher-2 text-cypher-5"
            : active
              ? "border-cypher-3 bg-cypher-3 text-cypher-5"
              : "border-cypher-5-1-1 bg-cypher-5-1-1 text-cypher-4-2-2",
        )}
      >
        <Shirt className="size-3" strokeWidth={2.5} />
      </span>
    </button>
  );
}