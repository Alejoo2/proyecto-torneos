"use client";

import { api } from "torneos/trpc/react";
import { Button } from "torneos/components/ui/button/button";
import { CourtAvailabilityMatrix } from "torneos/components/ui/court-availability-matrix/court-availability-matrix";

interface CourtDetailTemplateProps {
  courtId: string;
  isAdmin: boolean; // Se inyecta desde el servidor
}

export function CourtDetailTemplate({ courtId, isAdmin }: CourtDetailTemplateProps) {
  const utils = api.useUtils();
  
  const [court] = api.court.getById.useSuspenseQuery({ courtId });
  const [availability] = api.court.getAvailability.useSuspenseQuery({ courtId });

  const toggleMutation = api.court.toggleAvailability.useMutation({
    onSuccess: () => utils.court.getAvailability.invalidate({ courtId }),
  });

  const setMutation = api.court.setAvailability.useMutation({
    onSuccess: () => utils.court.getAvailability.invalidate({ courtId }),
  });

  const disableMutation = api.court.disable.useMutation({
    onSuccess: () => {
      utils.court.getById.invalidate({ courtId });
      utils.court.getAvailability.invalidate({ courtId });
    },
  });

  const enableMutation = api.court.enable.useMutation({
    onSuccess: () => utils.court.getById.invalidate({ courtId }),
  });

  const handleToggle = (date: Date, timeSlot: number) => {
    toggleMutation.mutate({ courtId, date, timeSlot });
  };

  const handleCloseDay = (date: Date) => {
    // Generar las 12 franjas como UNAVAILABLE
    const slots = Array.from({ length: 12 }, (_, timeSlot) => ({
      date,
      timeSlot,
      status: "UNAVAILABLE" as const,
    }));
    setMutation.mutate({ courtId, slots });
  };

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* HERO */}
      <div className="relative w-full h-32 bg-zinc-100 flex items-center justify-center border-b border-zinc-200">
        <div className="text-center">
          <p className="text-xs text-zinc-400">Ilustración de cancha</p>
        </div>
        <div className={`absolute top-4 right-4 px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 ${
          court.status === "ENABLED" ? "bg-green-600 text-white" : "bg-red-600 text-white"
        }`}>
          <div className="w-1.5 h-1.5 bg-white rounded-full" />
          {court.status === "ENABLED" ? "Habilitada" : "Deshabilitada"}
        </div>
      </div>

      {/* INFO PRINCIPAL */}
      <div className="px-6 py-6">
        <h1 className="text-xl font-bold text-zinc-900 mb-1">{court.name}</h1>
        <p className="text-sm text-zinc-500 mb-6">{court.address}</p>

        {court.description && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-zinc-800 mb-2">Descripción</h2>
            <p className="text-sm text-zinc-600 leading-relaxed">{court.description}</p>
          </div>
        )}

        {court.inventory && (
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-zinc-800 mb-2">Implementos</h2>
            <p className="text-sm text-zinc-600">{court.inventory}</p>
          </div>
        )}

        {/* Botón de Deshabilitar Total (Solo Admin) */}
        {isAdmin && (
          <div className="mb-8">
            {court.status === "ENABLED" ? (
              <Button 
                variant="destructive" 
                onClick={() => disableMutation.mutate({ courtId })}
                isLoading={disableMutation.isPending}
              >
                Deshabilitar Cancha Totalmente
              </Button>
            ) : (
              <Button 
                variant="secondary" 
                onClick={() => enableMutation.mutate({ courtId })}
                isLoading={enableMutation.isPending}
              >
                Habilitar Cancha
              </Button>
            )}
          </div>
        )}

        {/* Matriz de Disponibilidad */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-zinc-800">Disponibilidad (2 semanas)</h2>
          </div>
          
          <div className="bg-zinc-50 rounded-2xl p-4 border border-zinc-100">
            <CourtAvailabilityMatrix
              startDate={today}
              slots={availability.map(a => ({ date: a.date, timeSlot: a.timeSlot, status: a.status }))}
              isCourtDisabled={court.status === "DISABLED"}
              isReadOnly={!isAdmin} // Si no es admin, modo lectura
              onToggleSlot={isAdmin ? handleToggle : undefined}
              onCloseDay={isAdmin ? handleCloseDay : undefined}
            />
          </div>
        </div>
      </div>
    </div>
  );
}