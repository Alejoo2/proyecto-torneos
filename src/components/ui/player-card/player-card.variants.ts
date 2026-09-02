import { cva, type VariantProps } from "class-variance-authority";

export const playerCardVariants = cva(
  "bg-gray-100 rounded-2xl p-4 flex items-center gap-4 transition-all duration-200",
  {
    variants: {
      status: {
        default: "bg-gray-100",
        saturated: "bg-red-50 border border-red-200", // Si el jugador está saturado
      },
    },
    defaultVariants: {
      status: "default",
    },
  }
);

export type PlayerCardVariants = VariantProps<typeof playerCardVariants>;