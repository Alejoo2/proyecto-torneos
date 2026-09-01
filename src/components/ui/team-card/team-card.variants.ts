import { cva } from "class-variance-authority";

export const teamCardVariants = cva(
  "relative w-full rounded-2xl border border-gray-100 overflow-hidden shadow-md flex flex-col",
  {
    variants: {
      status: {
        DRAFT: "opacity-80 border-dashed",
        ACTIVE: "opacity-100",
        INACTIVE: "opacity-50 grayscale",
      },
    },
    defaultVariants: {
      status: "ACTIVE",
    },
  }
);