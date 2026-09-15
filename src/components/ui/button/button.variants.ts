import { cva, type VariantProps } from "class-variance-authority";

// Re-skin Wave 2 — construido SOLO desde la matriz 4.3:
// primary = lima (cypher-2) con texto grafito; hover/activan derivados -1/-2.
// destructive = familia semántica estándar (doc 4.5, TECH-DEBT-COLOR-SEMANTICS).
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cypher-2/60 focus-visible:ring-offset-2 focus-visible:ring-offset-cypher-5 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-cypher-2 text-cypher-5 hover:bg-cypher-2-1 active:bg-cypher-2-2",
        secondary: "bg-cypher-5-1-1 text-cypher-4 hover:bg-cypher-4/10 active:bg-cypher-4/15",
        outline:
          "border border-cypher-4-2-2/40 bg-transparent text-cypher-4 hover:bg-cypher-4/5 active:bg-cypher-4/10",
        ghost: "bg-transparent text-cypher-4-2 hover:bg-cypher-4/5 hover:text-cypher-4 active:bg-cypher-4/10",
        destructive: "bg-red-600 text-white hover:bg-red-700 active:bg-red-800",
      },
      size: {
        sm: "h-9 px-4 text-sm min-h-[44px]",
        md: "h-11 px-6 text-base min-h-[44px]",
        lg: "h-14 px-8 text-lg min-h-[56px]",
        icon: "h-11 w-11 min-h-[44px] min-w-[44px]",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;