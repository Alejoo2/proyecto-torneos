import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "torneos/lib/utils";

// Semánticos = familias estándar de Tailwind (doc 4.5, deuda TECH-DEBT-COLOR-SEMANTICS).
// cva construye solo desde la matriz 4.3 + semánticos autorizados.
const badgeVariants = cva("inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[11px] font-medium", {
  variants: {
    variant: {
      success: "bg-green-500/15 text-green-400",
      warning: "bg-yellow-500/15 text-yellow-400",
      error: "bg-red-500/15 text-red-400",
      neutral: "bg-cypher-5-1-1 text-cypher-4-2",
    },
  },
  defaultVariants: { variant: "neutral" },
});

interface BadgeProps extends VariantProps<typeof badgeVariants> {
  status: string;
  className?: string;
}

export function Badge({ variant, status, className }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)}>{status}</span>;
}