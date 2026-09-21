import { Badge } from "torneos/components/ui/badge";
import { TEAM_STATUS_LABEL } from "torneos/domain/status-labels";
import { cn } from "torneos/lib/utils";

interface TeamCardProps {
  name: string;
  abbreviation: string;
  primaryColor: string;
  secondaryColor?: string | null;
  status: "DRAFT" | "ACTIVE" | "INACTIVE";
  className?: string;
}

/** Card de equipo (W7). Franja SVG con primaryColor (CSS var dinámica, permitido).
 *  El estado viaja por Badge (status-labels), jamás por acentos. */
export function TeamCard({
  name,
  abbreviation,
  primaryColor,
  secondaryColor,
  status,
  className,
}: TeamCardProps) {
  const statusLabel = TEAM_STATUS_LABEL[status];
  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-2xl border border-cypher-5-1-1 bg-cypher-5-1",
        className,
      )}
    >
      <svg className="block h-2 w-full" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">
        <rect width="100" height="10" fill={primaryColor} />
        {secondaryColor && <rect x="75" width="25" height="10" fill={secondaryColor} />}
      </svg>
      <div className="flex items-center gap-3 p-4">
        <svg className="size-12 shrink-0" viewBox="0 0 40 40" aria-hidden="true">
          <rect width="40" height="40" rx="8" fill={primaryColor} />
          <text x="20" y="25" textAnchor="middle" className="fill-cypher-5 font-bold text-[11px]">
            {abbreviation}
          </text>
        </svg>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-bold uppercase text-cypher-4">{name}</h3>
          <div className="mt-1">
            <Badge variant={statusLabel.variant} status={statusLabel.label} />
          </div>
        </div>
      </div>
    </div>
  );
}