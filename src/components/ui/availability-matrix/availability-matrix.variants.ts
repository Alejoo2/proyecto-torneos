import { cva } from "class-variance-authority";

// W6 re-skin Cypher. AVAILABLE/CONFLICT = semánticos estándar (4.5, TECH-DEBT-COLOR-SEMANTICS);
// emerald es la familia semántica de facto del proyecto. UNAVAILABLE = neutro Cypher.
// CONFLICT: existe en el contrato de props pero el modelo NO lo emite
// (AvailabilityStatus = AVAILABLE | UNAVAILABLE) — no prometerlo en copy.
export const cellVariants = cva(
  "h-10 w-full rounded-md transition-all duration-150 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-cypher-5 focus-visible:ring-cypher-2/60 cursor-pointer",
  {
    variants: {
      status: {
        AVAILABLE: "bg-emerald-500/80 hover:bg-emerald-400 border border-emerald-400",
        UNAVAILABLE: "bg-cypher-5-1-1 hover:bg-cypher-4/10 border border-cypher-4-2-2/40",
        CONFLICT: "bg-amber-500/80 hover:bg-amber-400 border border-amber-400 cursor-not-allowed",
      },
    },
    defaultVariants: {
      status: "UNAVAILABLE",
    },
  }
);