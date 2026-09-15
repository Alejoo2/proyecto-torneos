import { ENROLLMENT_STATUS, type EnrollmentStatus } from "torneos/domain/status-labels";
import { cn } from "torneos/lib/utils";

// Filtro 100% cliente (decisión cerrada del hub): la cache key de
// listByTournament es única ("ALL") y este filtro solo recorta el render.
export type EnrollmentFilter = EnrollmentStatus | "ALL";

interface ManagerFilterBarProps {
  active: EnrollmentFilter;
  counts: Record<EnrollmentFilter, number>;
  onChange: (filter: EnrollmentFilter) => void;
}

const CHIPS: { key: EnrollmentFilter; label: string }[] = [
  { key: "ALL", label: "Todas" },
  ...(Object.keys(ENROLLMENT_STATUS) as EnrollmentStatus[]).map((key) => ({
    key,
    label: ENROLLMENT_STATUS[key].label,
  })),
];

export function ManagerFilterBar({ active, counts, onChange }: ManagerFilterBarProps) {
  return (
    <nav aria-label="Filtrar inscripciones" className="-mx-5 overflow-x-auto px-5 scrollbar-hide">
      <div className="flex w-max gap-2">
        {CHIPS.map(({ key, label }) => {
          const isActive = key === active;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={isActive}
              onClick={() => onChange(key)}
              className={cn(
                "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors",
                isActive
                  ? "border-transparent bg-cypher-2 text-cypher-5"
                  : "border-cypher-4-2-2/40 text-cypher-4-2 hover:bg-cypher-4/5 active:bg-cypher-4/10",
              )}
            >
              {label}
              <span className={cn("text-xs", isActive ? "text-cypher-5/70" : "text-cypher-4-2/70")}>
                {counts[key]}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}