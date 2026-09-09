"use client";

import { useState } from "react";
import { api } from "torneos/trpc/react";
import { Button } from "torneos/components/ui/button/button";
import { CreateTournamentModal } from "torneos/components/ui/tournament/create-tournament-modal";
import Link from "next/link";

export function CourtDetailTemplate({ courtId }: { courtId: string }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Hook de utilidades de tRPC para invalidar queries
  const utils = api.useUtils();

  // Queries
  const { data: court } = api.court.getById.useQuery({ courtId });
  const { data: tournaments } = api.tournament.listByCourt.useQuery({ courtId });

  // Para saber si es gestor, intentamos resolver su perfil de manager.
  const { data: myManagerProfile } = api.admin.getMyManagerProfile.useQuery(undefined, {
    retry: false
  });

  // Mutación para crear
  const createMutation = api.tournament.create.useMutation({
    onSuccess: () => {
      setIsModalOpen(false);
      // Refresca la lista de torneos para que aparezca el nuevo
      void utils.tournament.listByCourt.invalidate();
    }
  });

  // Mutación para publicar (DRAFT -> SCHEDULED)
  const publishMutation = api.tournament.publish.useMutation({
    onSuccess: () => {
      // Refresca la lista para que cambie el estado y los botones
      void utils.tournament.listByCourt.invalidate();
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
          <Button 
            className="w-full min-h-[56px]" 
            onClick={() => setIsModalOpen(true)}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? "Creando..." : "+ Crear Torneo aquí"}
          </Button>
        </div>
      )}

      {/* Lista de Torneos */}
      <div className="px-6">
        <h2 className="text-base font-bold text-zinc-900 mb-4">Torneos Activos</h2>
        
        {tournaments && tournaments.length > 0 ? (
          <div className="space-y-3">
            {tournaments.map((t) => (
              <div 
                key={t.id} 
                className="bg-white border-2 border-zinc-100 rounded-2xl p-4 hover:border-zinc-300 transition-colors"
              >
                <div className="flex justify-between items-start mb-2">
                  <Link href={`/torneos/${t.id}`} className="flex-1">
                    <h3 className="font-semibold text-zinc-900 hover:underline">{t.name}</h3>
                  </Link>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                    t.status === "SCHEDULED" ? "bg-blue-100 text-blue-700" :
                    t.status === "IN_PROGRESS" ? "bg-green-100 text-green-700" :
                    "bg-zinc-100 text-zinc-700" // DRAFT u otros
                  }`}>
                    {t.status}
                  </span>
                </div>
                
                <div className="flex items-center gap-4 text-xs text-zinc-500 mb-3">
                  <span>👥 {t._count.enrollments}/{t.maxTeams} equipos</span>
                  <span>⏳ Cierra: {new Date(t.enrollmentDeadline).toLocaleDateString()}</span>
                </div>

                {/* Botones de Gestor condicionales */}
                {isManager && t.status === "DRAFT" && (
                  <Button 
                    size="sm" 
                    className="w-full"
                    onClick={() => publishMutation.mutate({ tournamentId: t.id })}
                    disabled={publishMutation.isPending}
                  >
                    {publishMutation.isPending ? "Publicando..." : "Publicar Torneo"}
                  </Button>
                )}

                {isManager && t.status === "SCHEDULED" && (
                  <Link href={`/torneos/${t.id}/gestion`}>
                    <Button size="sm" variant="secondary" className="w-full">
                      Gestionar Inscripciones
                    </Button>
                  </Link>
                )}
              </div>
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