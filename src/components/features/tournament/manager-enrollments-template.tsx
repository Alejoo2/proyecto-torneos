"use client";

import { api } from "torneos/trpc/react";
import { Button } from "torneos/components/ui/button/button";

export function ManagerEnrollmentsTemplate({ tournamentId }: { tournamentId: string }) {
  const utils = api.useUtils();

  // Queries
  const { data: enrollments, isLoading } = api.enrollment.listByTournament.useQuery({ 
    tournamentId, 
    status: "ALL" 
  });

  // Mutations
  const approveMutation = api.enrollment.approve.useMutation({
    onSuccess: () => utils.enrollment.listByTournament.invalidate({ tournamentId })
  });

  const closeAndDrawMutation = api.tournament.closeAndDraw.useMutation({
    onSuccess: () => {
      alert("¡Sorteo ejecutado! Torneo en progreso.");
      utils.enrollment.listByTournament.invalidate({ tournamentId });
    }
  });

  if (isLoading) return <div className="p-6 text-zinc-500">Cargando inscripciones...</div>;

  const pendingPayment = enrollments?.filter(e => e.status === "PENDING_PAYMENT") || [];
  const pendingAvailability = enrollments?.filter(e => e.status === "PENDING_AVAILABILITY") || [];
  const approved = enrollments?.filter(e => e.status === "APPROVED") || [];

  return (
    <div className="p-6 pb-8 space-y-8">
      <h1 className="text-xl font-bold text-zinc-900">Gestión de Inscripciones</h1>

      {/* Sección: Pendientes de Pago (Factor 2) */}
      <div>
        <h2 className="text-sm font-bold text-zinc-700 uppercase tracking-wide mb-3">
          Pendientes de Pago ({pendingPayment.length})
        </h2>
        <div className="space-y-3">
          {pendingPayment.map(env => (
            <div key={env.id} className="bg-white border-2 border-zinc-100 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-zinc-900">{env.team.name}</p>
                <p className="text-xs text-zinc-500">Cumple con disponibilidad horaria</p>
              </div>
              <Button 
                size="sm" 
                onClick={() => approveMutation.mutate({ enrollmentId: env.id })}
                disabled={approveMutation.isPending}
              >
                Aprobar Pago
              </Button>
            </div>
          ))}
          {pendingPayment.length === 0 && <p className="text-sm text-zinc-400">Nadie pendiente de pago.</p>}
        </div>
      </div>

      {/* Sección: Conflictos de Disponibilidad (Factor 1 fallido) */}
      <div>
        <h2 className="text-sm font-bold text-zinc-700 uppercase tracking-wide mb-3">
          Conflictos de Horario ({pendingAvailability.length})
        </h2>
        <div className="space-y-3">
          {pendingAvailability.map(env => (
            <div key={env.id} className="bg-red-50 border-2 border-red-100 rounded-2xl p-4">
              <p className="font-semibold text-zinc-900">{env.team.name}</p>
              <p className="text-xs text-red-600 mt-1">{env.availabilityNote}</p>
            </div>
          ))}
          {pendingAvailability.length === 0 && <p className="text-sm text-zinc-400">Sin conflictos.</p>}
        </div>
      </div>

      {/* Sección: Aprobados */}
      <div>
        <h2 className="text-sm font-bold text-zinc-700 uppercase tracking-wide mb-3">
          Aprobados ({approved.length})
        </h2>
        <div className="space-y-3">
          {approved.map(env => (
            <div key={env.id} className="bg-green-50 border-2 border-green-100 rounded-2xl p-4">
              <p className="font-semibold text-zinc-900">{env.team.name}</p>
              <p className="text-xs text-green-600 mt-1">Equipo confirmado en el torneo</p>
            </div>
          ))}
          {approved.length === 0 && <p className="text-sm text-zinc-400">Ningún equipo aprobado aún.</p>}
        </div>
      </div>

      {/* Botón de Cierre y Sorteo */}
      <div className="pt-4 border-t border-zinc-200">
        <Button 
          className="w-full min-h-[56px]"
          onClick={() => closeAndDrawMutation.mutate({ tournamentId })}
          disabled={closeAndDrawMutation.isPending || approved.length < 2}
        >
          {closeAndDrawMutation.isPending 
            ? "Sorteando..." 
            : `Cerrar Inscripciones y Sortear (${approved.length} equipos)`}
        </Button>
        {approved.length < 2 && (
          <p className="text-xs text-center text-zinc-400 mt-2">Necesitas al menos 2 equipos aprobados para sortear.</p>
        )}
      </div>
    </div>
  );
}