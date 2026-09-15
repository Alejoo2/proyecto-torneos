import { cn } from "torneos/lib/utils";

interface LoadingSkeletonProps {
  variant?: "card" | "row" | "grid";
  rows?: number;
  className?: string;
}

export function LoadingSkeleton({ variant = "row", rows = 4, className }: LoadingSkeletonProps) {
  if (variant === "grid") {
    return (
      <div className={cn("grid grid-cols-2 gap-3", className)}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-36 animate-pulse rounded-xl bg-cypher-5-1-1" />
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "animate-pulse bg-cypher-5-1-1",
        variant === "card" ? "h-36 w-full rounded-xl" : "h-12 w-full rounded-lg",
        className,
      )}
    />
  );
}