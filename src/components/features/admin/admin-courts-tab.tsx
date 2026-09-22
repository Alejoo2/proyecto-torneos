"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarCog, Pencil, Power, PowerOff } from "lucide-react";
import { api } from "torneos/trpc/react";
import { CourtForm } from "torneos/components/ui/court-form/court-form";
import { Button } from "torneos/components/ui/button/button";
import { Badge } from "torneos/components/ui/badge";
import { LoadingSkeleton } from "torneos/components/ui/loading-skeleton";
import { Toast } from "torneos/components/ui/toast";
import { ConfirmModal } from "torneos/components/ui/confirm-modal/confirm-modal";
import { COURT_STATUS_LABEL } from "torneos/domain/status-labels";
import { CourtAvailabilityEditor } from "torneos/components/features/court/court-availability-editor";

/** W10 — Pestaña Canchas: crear + EDITAR (court.update existe) + Habilitar/Deshabilitar
 *  CON cascada "Cancha Manda" (ConfirmModal con conteo real vía getBlockImpact) +
 *  editor de disponibilidad por franjas. Commit-style en cascadas (precedente loadResult). */
export function AdminCourtsTab() {
  const router = useRouter();
  const utils = api.useUtils();
  const [toast, setToast] = useState<{ title: string } | null>(null);
  const notify = (title: string) => setToast({ title });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [availabilityId, setAvailabilityId] = useState<string | null>(null);
  const [disableTarget, setDisableTarget] = useState<{ id: string; name: string; count: number } | null>(null);

  const { data: courts, isLoading } = api.court.list.useQuery({ status: "ALL" });

  const createMutation = api.court.create.useMutation({
    onSuccess: () => {
      notify("Cancha creada");
      void utils.court.list.invalidate({ status: "ALL" });
    },
  });

  const updateMutation = api.court.update.useMutation({
    onSuccess: () => {
      notify("Cancha actualizada");
      setEditingId(null);
      void utils.court.list.invalidate({ status: "ALL" });
    },
    onError: (e) => notify(e.message),
  });

  const enableMutation = api.court.enable.useMutation({
    onSuccess: () => {
      notify("Cancha habilitada");
      void utils.court.list.invalidate({ status: "ALL" });
    },
    onError: (e) => notify(e.message),
  });

  const disableMutation = api.court.disableWithCascade.useMutation({
    onSuccess: (data) => {
      notify(`Cancha deshabilitada · ${data.postponed} partido(s) aplazado(s)`);
      setDisableTarget(null);
      void utils.court.list.invalidate({ status: "ALL" });
    },
    onError: (e) => notify(e.message),
  });

  const handleDisableClick = async (courtId: string, name: string) => {
    // Preview exacto ANTES de confirmar (regla P1)
    const impact = await utils.court.getBlockImpact.fetch({ courtId, slots: null });
    setDisableTarget({ id: courtId, name, count: impact.count });
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-cypher-5-1-1 bg-cypher-5-1 p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-cypher-4-2">
          Crear cancha
        </h2>
        <CourtForm onSubmit={(data) => createMutation.mutate(data)} isLoading={createMutation.isPending} />
        {createMutation.error && (
          <p className="mt-3 text-sm text-red-400" role="alert">{createMutation.error.message}</p>
        )}
      </section>

      <section className="rounded-2xl border border-cypher-5-1-1 bg-cypher-5-1 p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-cypher-4-2">
          Canchas existentes
        </h2>

        {isLoading ? (
          <LoadingSkeleton variant="row" rows={3} />
        ) : courts && courts.length > 0 ? (
          <div className="space-y-3">
            {courts.map((court) => {
              const statusMeta = COURT_STATUS_LABEL[court.status] ?? { label: court.status, variant: "neutral" as const };
              const enabled = court.status === "ENABLED";
              return (
                <div key={court.id} className="rounded-xl border border-cypher-5-1-1 bg-cypher-5-1-1 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-cypher-4">{court.name}</p>
                      <p className="truncate text-sm text-cypher-4-2-2">{court.address}</p>
                    </div>
                    <Badge variant={statusMeta.variant} status={statusMeta.label} />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button
                      variant="secondary" size="sm"
                      onClick={() => { setEditingId(editingId === court.id ? null : court.id); setAvailabilityId(null); }}
                    >
                      <Pencil className="size-3.5" /> Editar
                    </Button>
                    <Button
                      variant="secondary" size="sm"
                      onClick={() => { setAvailabilityId(availabilityId === court.id ? null : court.id); setEditingId(null); }}
                      disabled={!enabled}
                      title={enabled ? undefined : "Habilita la cancha para editar su disponibilidad"}
                    >
                      <CalendarCog className="size-3.5" /> Disponibilidad
                    </Button>
                    <Button
                      variant="secondary" size="sm"
                      onClick={() => router.push(`/canchas/${court.id}`)}
                    >
                      Ver detalle
                    </Button>
                    {enabled ? (
                      <Button
                        variant="secondary" size="sm"
                        onClick={() => void handleDisableClick(court.id, court.name)}
                        disabled={disableMutation.isPending}
                      >
                        <PowerOff className="size-3.5" /> Deshabilitar
                      </Button>
                    ) : (
                      <Button
                        variant="secondary" size="sm"
                        onClick={() => enableMutation.mutate({ courtId: court.id })}
                        disabled={enableMutation.isPending}
                      >
                        <Power className="size-3.5" /> Habilitar
                      </Button>
                    )}
                  </div>

                  {editingId === court.id && (
                    <div className="mt-4 border-t border-cypher-5-1-1 pt-4">
                      <CourtForm
                        key={`edit-${court.id}`}
                        initialValues={{
                          name: court.name,
                          address: court.address,
                          description: court.description ?? "",
                          inventory: court.inventory ?? "",
                        }}
                        submitLabel="Guardar cambios"
                        isLoading={updateMutation.isPending}
                        onSubmit={(data) => updateMutation.mutate({ courtId: court.id, ...data })}
                      />
                    </div>
                  )}

                  {availabilityId === court.id && (
                    <div className="mt-4 border-t border-cypher-5-1-1 pt-4">
                      <CourtAvailabilityEditor courtId={court.id} courtName={court.name} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="py-4 text-center text-sm text-cypher-4-2-2">
            No hay canchas registradas. Crea la primera arriba.
          </p>
        )}
      </section>

      <ConfirmModal
        isOpen={disableTarget !== null}
        title="Deshabilitar cancha"
        message={
          disableTarget && disableTarget.count > 0
            ? `Al deshabilitar "${disableTarget.name}" se aplazarán ${disableTarget.count} partido(s) futuros (quedarán pendientes de asignación de horario) y se cerrará toda su disponibilidad. Los resultados y estadísticas ya cargados NO se tocan.\n\n¿Confirmar?`
            : `Al deshabilitar "${disableTarget?.name}" se cerrará toda su disponibilidad. No hay partidos futuros afectados.\n\n¿Confirmar?`
        }
        confirmText={disableMutation.isPending ? "Aplicando..." : "Deshabilitar"}
        variant="danger"
        onConfirm={() => disableTarget && disableMutation.mutate({ courtId: disableTarget.id })}
        onCancel={() => setDisableTarget(null)}
      />

      <Toast toast={toast} />
    </div>
  );
}