"use client";

interface StatCardProps {
  value: string;
  label: string;
  /** Nota pequeña bajo el label (ej: "(menor = mejor)"). */
  note?: string;
  /** Texto que viaja al Toast al tocar (fórmula, aclaración). */
  detail: string;
    onTap: (detail: string) => void;
}

/** W9 — Card grande de estadística (wireframe: grid 2×2). Tap → Toast con detail
 *  (el tooltip hover del wireframe muere: mobile + Toast abajo = decisión cerrada). */
export function StatCard({ value, label, note, detail, onTap }: StatCardProps) {
  return (
    <button
      type="button"
      onClick={() => onTap(detail)}
      className="flex min-h-[120px] flex-col items-center justify-center rounded-2xl bg-cypher-5-1 p-5 text-center transition-colors active:bg-cypher-5-1-1"
    >
      <span className="text-3xl font-bold tabular-nums text-cypher-4">{value}</span>
      <span className="mt-1 text-xs text-cypher-4-2">{label}</span>
      {note && <span className="mt-0.5 text-[10px] text-cypher-4-2-2">{note}</span>}
    </button>
  );
}