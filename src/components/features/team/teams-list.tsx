"use client";
import Link from "next/link";
import { useMyTeams } from "torneos/components/features/team/use-team";

export function TeamsList() {
  const { data: teams, isLoading } = useMyTeams();

  if (isLoading) return <p className="text-gray-500">Cargando equipos...</p>;
  
  if (!teams || teams.length === 0) {
    return (
      <p className="text-gray-500 bg-gray-50 p-4 rounded-xl text-center">
        Aún no perteneces a ningún equipo. Crea uno nuevo abajo.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {teams.map((team) => (
        <Link 
          key={team.id} 
          href={`/equipos/${team.id}`}
          className="block bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-4 mb-3">
            {/* Workaround de color dinámico SVG */}
            <svg className="w-3 h-12 rounded-full" viewBox="0 0 10 48" aria-hidden="true">
              <rect width="10" height="48" rx="5" fill={team.primaryColor} />
            </svg>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{team.name}</h2>
              <p className="text-xs text-gray-500 uppercase font-medium tracking-wide">
                {team.abbreviation} · {team.status}
              </p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}