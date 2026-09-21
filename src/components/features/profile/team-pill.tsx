import Link from "next/link";
import { Crown } from "lucide-react";

interface TeamPillProps {
  href: string;
  abbreviation: string;
  primaryColor: string;
  isCaptain?: boolean;
}

/** W9 — Chip de equipo del header de perfil (wireframe: punto de color + tag + ⭐).
 *  Cápsula local del perfil (TeamChip queda para hero/tablas); color dinámico por
 *  SVG fill (excepción permitida); corona = informativo gris, jamás acento. */
export function TeamPill({ href, abbreviation, primaryColor, isCaptain }: TeamPillProps) {
  return (
    <Link
      href={href}
      className="flex shrink-0 items-center gap-1.5 rounded-full bg-cypher-5-1-1 px-3 py-1.5 transition-colors active:bg-cypher-4/10"
    >
      <svg className="size-4 rounded-full" viewBox="0 0 10 10" aria-hidden="true">
        <rect width="10" height="10" fill={primaryColor} />
      </svg>
      <span className="text-xs font-medium text-cypher-4">{abbreviation}</span>
      {isCaptain && <Crown className="size-3 text-cypher-4-2" aria-label="Capitán" />}
    </Link>
  );
}