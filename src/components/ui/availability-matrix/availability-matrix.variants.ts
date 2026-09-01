import { cva } from "class-variance-authority";

export const cellVariants = cva(
  "h-10 w-full rounded-md transition-all duration-150 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-900 focus:ring-white cursor-pointer",
  {
    variants: {
      status: {
        AVAILABLE: "bg-emerald-500/80 hover:bg-emerald-400 border border-emerald-400",
        UNAVAILABLE: "bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 opacity-50",
        CONFLICT: "bg-amber-500/80 hover:bg-amber-400 border border-amber-400 cursor-not-allowed",
      },
    },
    defaultVariants: {
      status: "UNAVAILABLE",
    },
  }
);