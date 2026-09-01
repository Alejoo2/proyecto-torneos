import { teamCardVariants } from "./team-card.variants";
import { cn } from "torneos/lib/utils";

interface TeamCardProps {
  name: string;
  abbreviation: string;
  primaryColor: string;
  secondaryColor?: string | null;
  playerCount: number;
  tournamentCount: number;
  status?: "DRAFT" | "ACTIVE" | "INACTIVE";
  className?: string;
}

export function TeamCard({
  name,
  abbreviation,
  primaryColor,
  secondaryColor,
  playerCount,
  tournamentCount,
  status = "ACTIVE",
  className,
}: TeamCardProps) {
  return (
    <div className={cn(teamCardVariants({ status }), className)}>
      {/* Barra superior de color usando SVG para evitar style={{}} */}
      <svg className="w-full h-2 block" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">
        <rect width="100" height="10" fill={primaryColor} />
        {secondaryColor && (
          <rect x="75" width="25" height="10" fill={secondaryColor} />
        )}
      </svg>
      
      <div className="p-4 flex flex-col gap-3 bg-white">
        <div className="flex items-center gap-3">
          {/* Escudo visual con color primario */}
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-sm overflow-hidden">
            <svg viewBox="0 0 40 40" className="w-full h-full" aria-hidden="true">
              <rect width="40" height="40" rx="8" fill={primaryColor} />
              <text x="20" y="26" textAnchor="middle" className="fill-white font-bold text-xs">{abbreviation}</text>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate uppercase">{name}</h3>
            <p className="text-xs text-gray-500">
              {status === "DRAFT" ? "En Borrador" : status === "ACTIVE" ? "Activo" : "Inactivo"}
            </p>
          </div>
        </div>

        {/* Slots placeholder visuales (5 slots) */}
        <div className="flex gap-2 my-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="w-10 h-10 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-400">
              ?
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between text-xs text-gray-600 border-t border-gray-100 pt-3">
          <span>👥 {playerCount} jugadores</span>
          <span>🏆 {tournamentCount} torneos</span>
        </div>
      </div>
    </div>
  );
}