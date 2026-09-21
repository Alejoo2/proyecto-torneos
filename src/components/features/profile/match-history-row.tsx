import Link from "next/link";

interface MatchHistoryRowProps {
  href: string;
  title: string;
  subtitle: string;
  goals: number;
}

/** W9 — Fila del historial (wireframe: torneo—fase + fecha + badge derecho).
 *  El badge del wireframe decía "Stats cargadas": redundante (la fuente de esta
 *  lista SOLO tiene partidos con stats) → mostramos los goles del partido. */
export function MatchHistoryRow({ href, title, subtitle, goals }: MatchHistoryRowProps) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 rounded-2xl bg-cypher-5-1 p-4 transition-colors active:bg-cypher-5-1-1"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-cypher-4">{title}</p>
        <p className="text-xs text-cypher-4-2-2">{subtitle}</p>
      </div>
      <span className="shrink-0 text-[11px] font-medium text-cypher-4-2">
        {goals === 0 ? "Sin goles" : `${goals} ${goals === 1 ? "gol" : "goles"}`}
      </span>
    </Link>
  );
}