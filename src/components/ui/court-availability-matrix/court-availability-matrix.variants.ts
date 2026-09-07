import { cva, type VariantProps } from "class-variance-authority";

export const courtCellVariants = cva(
  "h-8 rounded-md transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-zinc-900 disabled:cursor-not-allowed",
  {
    variants: {
      status: {
        AVAILABLE: "bg-green-500 hover:bg-green-600 active:bg-green-700",
        UNAVAILABLE: "bg-zinc-200 hover:bg-zinc-300 active:bg-zinc-400",
        DISABLED: "bg-red-500 opacity-50 cursor-not-allowed",
      },
    },
    defaultVariants: {
      status: "UNAVAILABLE",
    },
  }
);

export type CourtCellVariantProps = VariantProps<typeof courtCellVariants>;