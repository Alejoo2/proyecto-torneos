"use client";

import { useState } from "react";
import { api } from "torneos/trpc/react";
import { Button } from "torneos/components/ui/button/button";
import { CreateTournamentModal } from "torneos/components/ui/tournament/create-tournament-modal";
import Link from "next/link";

export function CourtDetailTemplate({ courtId }: { courtId: string }) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Queries
  const { data: court } = api.court.getById.useQuery({ courtId });
  const { data: tournaments } = api.tournament.listByCourt.useQuery({ courtId });

  // Para saber si es gestor, intentamos resolver su perfil de manager.
  // Si no lo es, la query devolverá null y simplemente no verá el botón.
  const { data: myManagerProfile } = api.admin.getMyManagerProfile.useQuery(undefined, {
    retry: false
  });

  // Mutations
  const createMutation = api.tournament.create.useMutation({
    onSuccess: (newTournament) => {
      setIsModalOpen(false);
      // Por ahora el torneo se crea en DRAFT. 
      // Idealmente aquí mismo llamamos a publish o lo mandamos a una pantalla de gestión.
      alert("Torneo creado en estado DRAFT. Ve a la API o BD para publicarlo (SCHEDULED) por ahora.");
    }
  });

  const isManager = !!myManagerProfile;

  return (
    <div className="pb-8">
      {/* Header Cancha */}
      <div className="px-6 pt-5 pb-4">
        <h1 className="text-xl font-bold text-zinc-900 mb-1">{court?.name || "Cancha"}</h1>
        <p className="text-sm text-zinc-500">{court?.address}</p>
      </div>

      {/* Acción Gestor */}
      {isManager && (
        <div className="px-6 mb-8">
          <Button className="w-full min-h-[56px]" onClick={() => setIsModalOpen(true)}>
            + Crear Torneo aquí
          </Button>
        </div>
      )}

      {/* Lista de Torneos */}
      <div className="px-6">
        <h2 className="text-base font-bold text-zinc-900 mb-4">Torneos Activos</h2>
        
        {tournaments && tournaments.length > 0 ? (
          <div className="space-y-3">
            {tournaments.map((t) => (
              <Link 
                key={t.id} 
                href={`/torneos/${t.id}`}
                className="block bg-white border-2 border-zinc-100 rounded-2xl p-4 hover:border-zinc-300 transition-colors"
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-zinc-900">{t.name}</h3>
                  <span className="text-xs font-medium bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                    {t.status}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-zinc-500">
                  <span>👥 {t._count.enrollments}/{t.maxTeams} equipos</span>
                  <span>⏳ Cierra: {new Date(t.enrollmentDeadline).toLocaleDateString()}</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-zinc-50 rounded-2xl p-6 text-center border border-zinc-100">
            <p className="text-sm text-zinc-500">No hay torneos activos en esta cancha.</p>
          </div>
        )}
      </div>

      {/* Modal Crear Torneo */}
      <CreateTournamentModal 
        courtId={courtId}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreate={(data) => createMutation.mutate(data)}
      />
    </div>
  );
}