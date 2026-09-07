"use client";

import { useRouter } from "next/navigation";
import { api } from "torneos/trpc/react";
import { CourtForm } from "torneos/components/ui/court-form/court-form";
import { Button } from "torneos/components/ui/button/button";

export function AdminCourtTemplate() {
  const router = useRouter();
  
  // Obtener todas las canchas
  const { data: courts, isLoading } = api.court.list.useQuery({
    status: "ALL",
  });

  // Mutación para crear cancha
  const createMutation = api.court.create.useMutation({
    onSuccess: (newCourt) => {
      // Al crear, navegamos al detalle para ver la matriz generada
      router.push(`/canchas/${newCourt.id}`);
    },
  });

  return (
    <div className="space-y-8">
      {/* Sección de Creación */}
      <div className="bg-white rounded-2xl p-6 border border-zinc-200">
        <h2 className="text-lg font-bold text-zinc-900 mb-4">Crear Nueva Cancha</h2>
        <CourtForm 
          onSubmit={(data) => createMutation.mutate(data)} 
          isLoading={createMutation.isPending} 
        />
        {createMutation.error && (
          <p className="text-red-500 text-sm mt-2">
            Error: {createMutation.error.message}
          </p>
        )}
      </div>

      {/* Sección de Listado */}
      <div className="bg-white rounded-2xl p-6 border border-zinc-200">
        <h2 className="text-lg font-bold text-zinc-900 mb-4">Canchas Existentes</h2>
        
        {isLoading ? (
          <p className="text-zinc-500">Cargando...</p>
        ) : courts && courts.length > 0 ? (
          <div className="space-y-3">
            {courts.map((court) => (
              <div 
                key={court.id} 
                className="flex items-center justify-between p-4 rounded-xl bg-zinc-50 border border-zinc-100"
              >
                <div>
                  <p className="font-semibold text-zinc-900">{court.name}</p>
                  <p className="text-sm text-zinc-500">{court.address}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    court.status === "ENABLED" 
                      ? "bg-green-100 text-green-700" 
                      : "bg-red-100 text-red-700"
                  }`}>
                    {court.status === "ENABLED" ? "Habilitada" : "Deshabilitada"}
                  </span>
                  <Button 
                    variant="secondary" 
                    size="sm"
                    onClick={() => router.push(`/canchas/${court.id}`)}
                  >
                    Administrar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-zinc-500 text-center py-4">
            No hay canchas registradas. Crea una arriba.
          </p>
        )}
      </div>
    </div>
  );
}