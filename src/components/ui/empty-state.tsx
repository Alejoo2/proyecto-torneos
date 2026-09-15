import type { ReactNode } from "react";
import { cn } from "torneos/lib/utils";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 px-6 py-10 text-center", className)}>
      <div className="text-cypher-4-2-2">{icon}</div>
      <p className="text-sm font-semibold text-cypher-4">{title}</p>
      {description && <p className="text-xs text-cypher-4-2-2">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}