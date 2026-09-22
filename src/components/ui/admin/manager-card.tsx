// manager-card.tsx
import { cn } from "torneos/lib/utils";

interface ManagerCardProps {
  name: string;
  email: string;
  isActive: boolean;
  onToggleStatus: () => void;
}

/** W10 re-skin (contrato intacto). Turquesa = activo (idioma del sistema). */
export function ManagerCard({ name, email, isActive, onToggleStatus }: ManagerCardProps) {
  return (
    <div className="rounded-2xl border border-cypher-5-1-1 bg-cypher-5-1-1 p-4">
      <div className="flex items-center gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-cypher-5 font-bold text-cypher-4-2">
          {name.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-cypher-4">{name}</p>
          <p className="truncate text-xs text-cypher-4-2-2">{email}</p>
        </div>
        <button
          type="button"
          onClick={onToggleStatus}
          aria-pressed={isActive}
          aria-label={isActive ? `Desactivar a ${name}` : `Activar a ${name}`}
          className={cn(
            "relative h-8 w-14 shrink-0 rounded-full transition-colors",
            isActive ? "bg-cypher-3" : "bg-cypher-5",
          )}
        >
        <span
            className={cn(
              "absolute left-0 top-1 size-6 rounded-full bg-white transition-transform",
              isActive ? "translate-x-7" : "translate-x-1",
            )}
          />
        </button>
      </div>
    </div>
  );
}