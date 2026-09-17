import { cva, type VariantProps } from "class-variance-authority";

// W5 — Estados de celda de la matriz pública (solo lectura). Matriz 4.3 estricta:
// "free" = familia semántica estándar (doc UI/UX 4.5): el verde INFORMA disponibilidad.
// "busy" = superficie elevada 2 (5-1-1): ocupación NO es error, es gris elevado.
// Sin estado "off": getBubble solo devuelve canchas ENABLED (DISABLED → 404 en la page).
export const courtAvailabilityCellVariants = cva("h-7 flex-1 rounded-[4px]", {
  variants: {
    state: {
      free: "bg-green-500",
      busy: "bg-cypher-5-1-1",
    },
  },
  defaultVariants: {
    state: "busy",
  },
});

export type CourtAvailabilityCellVariantProps = VariantProps<typeof courtAvailabilityCellVariants>;