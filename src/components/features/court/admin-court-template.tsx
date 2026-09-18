"use client";

import { useRouter } from "next/navigation";
import { api } from "torneos/trpc/react";
import { CourtForm } from "torneos/components/ui/court-form/court-form";
import { Button } from "torneos/components/ui/button/button";
import { Badge } from "torneos/components/ui/badge";
import { LoadingSkeleton } from "torneos/components/ui/loading-skeleton";
import { COURT_STATUS_LABEL } from "torneos/domain/status-labels";

// W5 — Re-skin admin de canchas (piel blanca → Cypher). Entry point MÍNIMO:
// mismas queries/mutaciones del scaffold, sin guards nuevos — el backend ya exige
// "court:create" (solo admin) en cada procedimiento. Sin optimistic: la navegación
// al detalle tras crear ES la confirmación; el error (ej. CONFLICT nombre
// duplicado) se muestra en línea bajo el form (patrón W4 — no hay toast API).
// Fix QA-W5: Badge es archivo suelto (ui/badge) y su contrato real es
// { variant, status(label) } — sin children.

export function AdminCourtTemplate() {
  const router = useRouter();

  const { data: courts, isLoading } = api.court.list.useQuery({ status: "ALL" });

  const createMutation = api.court.create.useMutation({
    onSuccess: (newCourt) => {
      router.push(`/canchas/${newCourt.id}`);
    },
  });

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-cypher-4/10 bg-cypher-5-1 p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-cypher-4-2">
          Crear nueva cancha
        </h2>
        <CourtForm onSubmit={(data) => createMutation.mutate(data)} isLoading={createMutation.isPending} />
        {createMutation.error && (
          <p className="mt-3 text-sm text-red-400" role="alert">
            {createMutation.error.message}
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-cypher-4/10 bg-cypher-5-1 p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-cypher-4-2">
          Canchas existentes
        </h2>

        {isLoading ? (
          <LoadingSkeleton variant="row" rows={3} />
        ) : courts && courts.length > 0 ? (
          <div className="space-y-3">
            {courts.map((court) => {
              const statusMeta = COURT_STATUS_LABEL[court.status] ?? {
                label: court.status,
                variant: "neutral" as const,
              };
              return (
                <div
                  key={court.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-cypher-4/10 bg-cypher-5-1-1 p-4"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-cypher-4">{court.name}</p>
                    <p className="truncate text-sm text-cypher-4-2-2">{court.address}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <Badge variant={statusMeta.variant} status={statusMeta.label} />
                    <Button variant="secondary" size="sm" onClick={() => router.push(`/canchas/${court.id}`)}>
                      Administrar
                    </Button>
                  </div>
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
    </div>
  );
}