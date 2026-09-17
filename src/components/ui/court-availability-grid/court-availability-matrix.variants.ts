import { cva, type VariantProps } from "class-variance-authority";

// W5 — Re-skin del EDITOR admin de franjas (matriz de 14 días, días=columnas).
// Mismas claves de variante (contrato intacto para court-availability-matrix.tsx),
// ahora desde la matriz 4.3: libre = verde semántico (4.5) · cerrada = superficie
// elevada 2 · cancha DISABLED = rojo atenuado.
// NO confundir con court-availability-grid.variants.ts (matriz PÚBLICA 7×12,
// solo lectura) — este exporta courtCellVariants; aquel, courtAvailabilityCellVariants.
export const courtCellVariants = cva(
  "h-8 rounded-md transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-cypher-2/60 disabled:cursor-not-allowed",
  {
    variants: {
      status: {
        AVAILABLE: "bg-green-500 hover:bg-green-600 active:bg-green-700",
        UNAVAILABLE: "bg-cypher-5-1-1 hover:bg-cypher-4/10 active:bg-cypher-4/15",
        DISABLED: "bg-red-500/40 opacity-60 cursor-not-allowed",
      },
    },
    defaultVariants: {
      status: "UNAVAILABLE",
    },
  }
);

export type CourtCellVariantProps = VariantProps<typeof courtCellVariants>;