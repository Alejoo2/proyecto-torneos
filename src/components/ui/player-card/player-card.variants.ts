import { cva, type VariantProps } from "class-variance-authority";

export const playerCardVariants = cva(
  "flex items-center gap-4 rounded-2xl border bg-cypher-5-1 p-4 transition-colors duration-200",
  {
    variants: {
      status: {
        default: "border-cypher-5-1-1/60",
        saturated: "border-red-400/40 bg-red-400/10", // Si el jugador está saturado
      },
    },
    defaultVariants: {
      status: "default",
    },
  }
);

export type PlayerCardVariants = VariantProps<typeof playerCardVariants>;