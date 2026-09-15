"use client";

import { useEffect,useRef, useState } from "react";
import { cn } from "torneos/lib/utils";

interface CountdownTimerProps {
  expiresAt: number; // epoch ms
  serverTimestamp: number; // epoch ms del servidor (evita skew de reloj, B-09)
  onExpire?: () => void; // reconciliación inmediata al llegar a 0 (Wave 2)
  className?: string;
}

export function CountdownTimer({ expiresAt, serverTimestamp, onExpire, className }: CountdownTimerProps) {
  // El countdown nace del reloj del servidor y solo decrece localmente.
  // onExpire via ref: cambiar la identidad del callback no reinicia el intervalo.
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;
  const [remaining, setRemaining] = useState(() => Math.max(0, expiresAt - serverTimestamp));

  useEffect(() => {
    setRemaining(Math.max(0, expiresAt - serverTimestamp));
    const id = setInterval(() => {
      setRemaining((r) => {
        const next = Math.max(0, r - 1000);
        if (next === 0) onExpireRef.current?.();
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [expiresAt, serverTimestamp]);

  const total = Math.floor(remaining / 1000);
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  const urgent = total <= 60 && total > 0;

  // Urgencia = semántico estándar (4.5). Jamás un acento Cypher.
  return (
    <span
      className={cn(
        "font-mono text-sm font-semibold tabular-nums",
        urgent ? "text-red-400" : "text-cypher-4",
        className,
      )}
    >
      {mm}:{ss}
    </span>
  );
}