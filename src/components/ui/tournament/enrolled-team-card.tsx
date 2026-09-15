import Link from "next/link";
import { Badge } from "torneos/components/ui/badge";
import { ENROLLMENT_STATUS } from "torneos/domain/status-labels";
import { cn } from "torneos/lib/utils";

interface EnrolledTeamCardProps {
  teamId: string;
  name: string;
  abbreviation: string;
  primaryColor: string;
  status: string;
  availabilityNote?: string | null;
  className?: string;
}

export function EnrolledTeamCard({
  teamId, name, abbreviation, primaryColor, status, availabilityNote, className,
}: EnrolledTeamCardProps) {
  const meta = ENROLLMENT_STATUS[status as keyof typeof ENROLLMENT_STATUS];
  return (
    <Link
      href={`/equipos/${teamId}`}
      className={cn(
        "block rounded-2xl border border-cypher-5-1-1/60 bg-cypher-5-1 p-4 transition-colors hover:border-cypher-4-2-2/40 active:bg-cypher-5-1-1",
        className,
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        {/* Excepción 3.2: color dinámico de BD como CSS var (patrón TeamChip) */}
        <span
          className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-(--team-color) text-sm font-bold text-cypher-5"
          style={{ "--team-color": primaryColor } as React.CSSProperties}
        >
          {abbreviation.slice(0, 3)}
        </span>
        <Badge variant={meta?.variant ?? "neutral"} status={meta?.label ?? status} />
      </div>
      <p className="truncate text-sm font-semibold text-cypher-4">{name}</p>
      {availabilityNote && status === "PENDING_AVAILABILITY" && (
        <p className="mt-1 truncate text-xs text-red-400">{availabilityNote}</p>
      )}
    </Link>
  );
}