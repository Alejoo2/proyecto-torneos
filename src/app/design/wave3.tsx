"use client";
import { useMemo, useState } from "react";
import { AnimatePresence } from "motion/react";
import { Inbox, RotateCcw } from "lucide-react";
import { EnrollmentRow } from "torneos/components/features/tournament/enrollment-row";
import {
  ManagerFilterBar,
  type EnrollmentFilter,
} from "torneos/components/features/tournament/manager-filter-bar";
import { EmptyState } from "torneos/components/ui/empty-state";
import type { EnrollmentStatus } from "torneos/domain/status-labels";

// Galería Wave 3 — QA visual de Gestión de Inscripciones. Los componentes son
// puros: acá se cablean a estado local que simula el flip optimistic.
// Sin fechas → sin relojes → sin suppressHydrationWarning.

type DemoEnrollment = {
  id: string;
  status: EnrollmentStatus;
  availabilityNote: string | null;
  disapprovedReason: string | null;
  team: { id: string; name: string; abbreviation: string; primaryColor: string };
};

// Una fila por estado del enum (los 5) + notas del engine verbatim.
const INITIAL: DemoEnrollment[] = [
  {
    id: "d1", status: "PENDING_PAYMENT", availabilityNote: null, disapprovedReason: null,
    team: { id: "t1", name: "Los Diablos", abbreviation: "DIA", primaryColor: "#E63946" },
  },
  {
    id: "d2", status: "PENDING_AVAILABILITY",
    availabilityNote: "Solo 3 de 8 jugadores disponibles en la franja del torneo",
    disapprovedReason: null,
    team: { id: "t2", name: "Águilas del Sur", abbreviation: "AGS", primaryColor: "#457B9D" },
  },
  {
    id: "d3", status: "APPROVED", availabilityNote: null, disapprovedReason: null,
    team: { id: "t3", name: "Real Vargas", abbreviation: "RVA", primaryColor: "#2A9D8F" },
  },
  {
    id: "d4", status: "REJECTED", availabilityNote: null,
    disapprovedReason: "Plantilla incompleta al cierre de la fecha de inscripción",
    team: { id: "t4", name: "Cobras FC", abbreviation: "COB", primaryColor: "#F4A261" },
  },
  {
    id: "d5", status: "DISAPPROVED", availabilityNote: null,
    disapprovedReason: "Pago no verificado o rechazado por el gestor",
    team: { id: "t5", name: "Atlético Norte", abbreviation: "ATN", primaryColor: "#7B2CBF" },
  },
];

const EMPTY_COUNTS: Record<EnrollmentFilter, number> = {
  ALL: 0,
  PENDING_AVAILABILITY: 0,
  PENDING_PAYMENT: 0,
  APPROVED: 0,
  REJECTED: 0,
  DISAPPROVED: 0,
};

export function Wave3Section() {
  const [enrollments, setEnrollments] = useState<DemoEnrollment[]>(INITIAL);
  const [filter, setFilter] = useState<EnrollmentFilter>("ALL");

  const counts = useMemo(() => {
    const acc = { ...EMPTY_COUNTS };
    for (const e of enrollments) {
      acc[e.status] += 1;
      acc.ALL += 1;
    }
    return acc;
  }, [enrollments]);

  const visible = filter === "ALL" ? enrollments : enrollments.filter((e) => e.status === filter);

  // Flip local = lo que en producción hace el optimistic del template (4.4).
  const flip = (id: string, patch: Partial<DemoEnrollment>) =>
    setEnrollments((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  return (
        <section className="px-5 pt-14 pb-nav-safe">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-widest text-cypher-4-2-2">
          Wave 3 — Gestión de inscripciones
        </h2>
        <button
          type="button"
          onClick={() => {
            setEnrollments(INITIAL);
            setFilter("ALL");
          }}
          className="inline-flex items-center gap-1.5 rounded-full bg-cypher-5-1-1 px-3 py-1 text-xs font-medium text-cypher-4-2 hover:bg-cypher-4/10 active:bg-cypher-4/15"
        >
          <RotateCcw className="size-3" />
          Reset
        </button>
      </div>
      <p className="mb-4 text-xs text-cypher-4-2-2">
        Una fila por estado. Acciones = transiciones del engine: aprobar solo desde
        pago pendiente · rechazar con motivo ≥ 10 · desaprobar con doble toque (auto-reset 3 s).
      </p>

      <div className="w-full space-y-4">
        <ManagerFilterBar active={filter} counts={counts} onChange={setFilter} />

        {visible.length === 0 ? (
          <EmptyState
            icon={<Inbox className="size-8" />}
            title="Nada por acá"
            description={`No hay inscripciones con este filtro. (Prueba aprobar la fila pendiente de pago y volver a este chip.)`}
          />
        ) : (
          <div className="space-y-3">
            <AnimatePresence initial={false} mode="popLayout">
              {visible.map((enrollment) => (
                <EnrollmentRow
                  key={enrollment.id}
                  enrollment={enrollment}
                  isBusy={false}
                  onApprove={(id) => flip(id, { status: "APPROVED" })}
                  onReject={(id, reason) => flip(id, { status: "REJECTED", disapprovedReason: reason })}
                  onDisapprove={(id) => flip(id, { status: "DISAPPROVED" })}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </section>
  );
}