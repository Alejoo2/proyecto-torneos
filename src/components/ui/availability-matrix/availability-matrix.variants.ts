import { cva } from "class-variance-authority";

// W6 re-skin Cypher. Verde/amarillo/rojo = semánticos estándar (4.5,
// TECH-DEBT-COLOR-SEMANTICS); UNAVAILABLE = neutro Cypher.
// S02 v2.0: SUGGESTED (amarillo, trazado por el equipo) y HARD_CONFLICT (rojo,
// derivado del fixture) son solo lectura para el jugador salvo allowToggleTraced.
export const cellVariants = cva(
  "h-7 w-full rounded-[4px] transition-all duration-150 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-cypher-5 focus-visible:ring-cypher-2/60 cursor-pointer",
  {
    variants: {
      status: {
        AVAILABLE: "bg-emerald-500/80 hover:bg-emerald-400 border border-emerald-400",
        UNAVAILABLE: "bg-cypher-5-1-1 hover:bg-cypher-4/10 border border-cypher-4-2-2/40",
        CONFLICT: "bg-amber-500/80 hover:bg-amber-400 border border-amber-400 cursor-not-allowed",
        SUGGESTED: "bg-amber-500/50 border border-amber-400/60 cursor-not-allowed",
        HARD_CONFLICT: "bg-red-500/80 border border-red-400 cursor-not-allowed",
      },
    },
    defaultVariants: {
      status: "UNAVAILABLE",
    },
  }
);