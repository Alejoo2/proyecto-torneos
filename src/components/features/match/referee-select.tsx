import { cn } from "torneos/lib/utils";

interface RefereeSelectProps {
  referees: { id: string; name: string }[];
  valueId: string | null;
  disabled?: boolean;
  isPending?: boolean;
  onChange: (refereeId: string | null) => void;
  className?: string;
}

/** Selector de árbitro del gestor (B-06b). null = desasignar. Optimistic en el template. */
export function RefereeSelect({
  referees, valueId, disabled, isPending, onChange, className,
}: RefereeSelectProps) {
  return (
    <label className={cn("block rounded-2xl bg-cypher-5-1 p-4", className)}>
      <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-cypher-4-2-2">
        Árbitro
      </span>
      <select
        value={valueId ?? ""}
        disabled={disabled || isPending}
        onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
        className="w-full rounded-lg border border-cypher-5-1-1 bg-cypher-5 px-3 py-2 text-sm text-cypher-4 outline-none focus:border-cypher-2 disabled:opacity-50"
      >
        <option value="">Sin árbitro asignado</option>
        {referees.map((r) => (
          <option key={r.id} value={r.id}>{r.name}</option>
        ))}
      </select>
    </label>
  );
}