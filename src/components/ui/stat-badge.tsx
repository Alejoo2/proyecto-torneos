import { cn } from "torneos/lib/utils";

interface StatBadgeProps {
  label: string;
  value: number | string;
  className?: string;
}

export function StatBadge({ label, value, className }: StatBadgeProps) {
  return (
    <span className={cn("inline-flex flex-col items-center rounded-lg bg-cypher-5-1 px-3 py-1.5", className)}>
      <span className="text-sm font-bold tabular-nums text-cypher-4">{value}</span>
      <span className="text-[10px] uppercase tracking-wide text-cypher-4-2-2">{label}</span>
    </span>
  );
}