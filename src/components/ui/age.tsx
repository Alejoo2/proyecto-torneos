"use client";

import { useEffect, useState } from "react";

function formatAge(ms: number): string {
  if (ms < 5_000) return "ahora";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `hace ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m}m`;
  return `hace ${Math.floor(m / 60)}h`;
}

export function Age({ dataUpdatedAt, className }: { dataUpdatedAt: number; className?: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className={className} suppressHydrationWarning>
      {formatAge(now - dataUpdatedAt)}
    </span>
  );
}