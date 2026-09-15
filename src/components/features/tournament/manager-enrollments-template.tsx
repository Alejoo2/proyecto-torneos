"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "motion/react";
import { Inbox, Lock } from "lucide-react";
import { api } from "torneos/trpc/react";
import { EnrollmentRow } from "torneos/components/features/tournament/enrollment-row";
import {
  ManagerFilterBar,
  type EnrollmentFilter,
} from "torneos/components/features/tournament/manager-filter-bar";
import { Badge } from "torneos/components/ui/badge";
import { Button } from "torneos/components/ui/button/button";
import { EmptyState } from "torneos/components/ui/empty-state";
import { LoadingSkeleton } from "torneos/components/ui/loading-skeleton";
import { Toast } from "torneos/components/ui/toast";
import {
  ENROLLMENT_STATUS,
  TOURNAMENT_STATUS,
  type EnrollmentStatus,
} from "torneos/domain/status-labels";

const MIN_TEAMS_TO_DRAW = 2; // precondición presentacional del sorteo

export function ManagerEnrollmentsTemplate({ tournamentId }: { tournamentId: string }) {
  const router = useRouter();
  const utils = api.useUtils();

  const [filter, setFilter] = useState<EnrollmentFilter>("ALL");
  const [toast, setToast] = useState<{ title: string } | null>(null);
  const [confirmingDraw, setConfirmingDraw] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  // Toast (protocolo 4.4): piel única del átomo — el texto informa, no el color.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);
  const notify = useCallback((title: string) => setToast({ title }), []);

  // Doble confirmación inline con auto-reset
  useEffect(() => {
    if (!confirmingDraw && !confirmingCancel) return;
    const t = setTimeout(() => {
      setConfirmingDraw(false);
      setConfirmingCancel(false);
    }, 4000);
    return () => clearTimeout(t);
  }, [confirmingDraw, confirmingCancel]);

  // Contexto: nombre + estado del torneo (define si siguen vivas las acciones finales)
  const tournamentQuery = api.tournament.getById.useQuery({ tournamentId }, { retry: false });

  // Fuente única: "ALL" en cache, filtrado 100% cliente (una sola cache key)
  const LIST_INPUT = useMemo(() => ({ tournamentId, status: "ALL" as const }), [tournamentId]);
  const listQuery = api.enrollment.listByTournament.useQuery(LIST_INPUT, { retry: false });

  const enrollments = useMemo(() => listQuery.data ?? [], [listQuery.data]);
  const tournament = tournamentQuery.data;

  const counts = useMemo<Record<EnrollmentFilter, number>>(() => {
    const acc = {
      ALL: 0,
      PENDING_AVAILABILITY: 0,
      PENDING_PAYMENT: 0,
      APPROVED: 0,
      REJECTED: 0,
      DISAPPROVED: 0,
    };
    for (const e of enrollments) {
      acc[e.status] += 1;
      acc.ALL += 1;
    }
    return acc;
  }, [enrollments]);

  const visible = useMemo(
    () => (filter === "ALL" ? enrollments : enrollments.filter((e) => e.status === filter)),
    [enrollments, filter],
  );

  // ── Optimistic + rollback (protocolo 4.4) sobre la única cache key ──
  const patchStatus = useCallback(
    (enrollmentId: string, patch: { status: EnrollmentStatus; disapprovedReason?: string | null }) => {
      utils.enrollment.listByTournament.setData(LIST_INPUT, (old) =>
        old?.map((e) => (e.id === enrollmentId ? { ...e, ...patch } : e)),
      );
    },
    [utils, LIST_INPUT],
  );

  const approveMutation = api.enrollment.approve.useMutation({
    onMutate: async ({ enrollmentId }) => {
      await utils.enrollment.listByTournament.cancel(LIST_INPUT);
      const prev = utils.enrollment.listByTournament.getData(LIST_INPUT);
      patchStatus(enrollmentId, { status: "APPROVED" });
      return { prev };
    },
    onSuccess: () => notify("Pago aprobado — equipo confirmado"),
    onError: (e, _vars, ctx) => {
      if (ctx?.prev) utils.enrollment.listByTournament.setData(LIST_INPUT, ctx.prev);
      notify(e.message);
    },
    onSettled: () => void utils.enrollment.listByTournament.invalidate(LIST_INPUT),
  });

  const rejectMutation = api.enrollment.reject.useMutation({
    onMutate: async ({ enrollmentId, reason }) => {
      await utils.enrollment.listByTournament.cancel(LIST_INPUT);
      const prev = utils.enrollment.listByTournament.getData(LIST_INPUT);
      patchStatus(enrollmentId, { status: "REJECTED", disapprovedReason: reason });
      return { prev };
    },
    onSuccess: () => notify("Inscripción rechazada"),
    onError: (e, _vars, ctx) => {
      if (ctx?.prev) utils.enrollment.listByTournament.setData(LIST_INPUT, ctx.prev);
      notify(e.message);
    },
    onSettled: () => void utils.enrollment.listByTournament.invalidate(LIST_INPUT),
  });

  const disapproveMutation = api.enrollment.disapprove.useMutation({
    onMutate: async ({ enrollmentId }) => {
      await utils.enrollment.listByTournament.cancel(LIST_INPUT);
      const prev = utils.enrollment.listByTournament.getData(LIST_INPUT);
      patchStatus(enrollmentId, { status: "DISAPPROVED" });
      return { prev };
    },
    onSuccess: () => notify("Equipo desaprobado"),
    onError: (e, _vars, ctx) => {
      if (ctx?.prev) utils.enrollment.listByTournament.setData(LIST_INPUT, ctx.prev);
      notify(e.message);
    },
    onSettled: () => void utils.enrollment.listByTournament.invalidate(LIST_INPUT),
  });

  const drawMutation = api.tournament.closeAndDraw.useMutation({
    onSuccess: () => {
      notify("Sorteo ejecutado — torneo en curso");
      void utils.tournament.getById.invalidate({ tournamentId });
      void utils.match.listByTournament.invalidate({ tournamentId });
      router.push(`/torneos/${tournamentId}`);
    },
    onError: (e) => notify(e.message),
  });

  const cancelMutation = api.tournament.cancel.useMutation({
    onSuccess: () => {
      notify("Torneo cancelado");
      void utils.tournament.getById.invalidate({ tournamentId });
      router.push(`/torneos/${tournamentId}`);
    },
    onError: (e) => notify(e.message),
  });

  // La mutación en vuelo deshabilita SOLO su fila
  const busyEnrollmentId =
    (approveMutation.isPending && approveMutation.variables?.enrollmentId) ||
    (rejectMutation.isPending && rejectMutation.variables?.enrollmentId) ||
    (disapproveMutation.isPending && disapproveMutation.variables?.enrollmentId) ||
    null;

  const handleDrawClick = useCallback(() => {
    if (drawMutation.isPending) return;
    if (!confirmingDraw) {
      setConfirmingCancel(false);
      setConfirmingDraw(true);
      return;
    }
    setConfirmingDraw(false);
    drawMutation.mutate({ tournamentId });
  }, [confirmingDraw, drawMutation, tournamentId]);

  const handleCancelClick = useCallback(() => {
    if (cancelMutation.isPending) return;
    if (!confirmingCancel) {
      setConfirmingDraw(false);
      setConfirmingCancel(true);
      return;
    }
    setConfirmingCancel(false);
    cancelMutation.mutate({ tournamentId });
  }, [confirmingCancel, cancelMutation, tournamentId]);

  if (listQuery.isLoading) {
    return <LoadingSkeleton variant="card" rows={4} className="pt-14" />;
  }

  if (listQuery.error?.data?.code === "FORBIDDEN") {
    return (
      <div className="pb-nav-safe pt-14">
        <div className="px-5 pt-10">
          <EmptyState
            icon={<Lock className="size-8" />}
            title="Sin acceso"
            description="Solo el gestor de este torneo puede ver sus inscripciones."
          />
        </div>
      </div>
    );
  }

  if (listQuery.isError) {
    return (
      <div className="pb-nav-safe pt-14">
        <div className="px-5 pt-10">
          <EmptyState
            icon={<Inbox className="size-8" />}
            title="No se pudieron cargar las inscripciones"
            description="Revisa tu conexión e intenta de nuevo."
            action={
              <Button size="sm" variant="secondary" onClick={() => void listQuery.refetch()}>
                Reintentar
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  // Sortear/cancelar solo tienen sentido antes de que arranque
  const canFinalize = tournament?.status === "SCHEDULED" || tournament?.status === "GRACE_PERIOD";

  return (
    <div className="pb-nav-safe pt-14">
      <header className="px-5 pt-4">
        <p className="text-xs font-medium uppercase tracking-widest text-cypher-4-2">Gestión</p>
        <div className="mt-1 flex items-center gap-2.5">
          <h1 className="truncate text-xl font-bold text-cypher-4">{tournament?.name ?? "Inscripciones"}</h1>
          {tournament && (
            <Badge
              variant={TOURNAMENT_STATUS[tournament.status].variant}
              status={TOURNAMENT_STATUS[tournament.status].label}
            />
          )}
        </div>
      </header>

      <div className="px-5 pt-5">
        <ManagerFilterBar active={filter} counts={counts} onChange={setFilter} />
      </div>

      <div className="mt-4 space-y-3 px-5">
        {visible.length === 0 ? (
          <EmptyState
            icon={<Inbox className="size-8" />}
            title="Nada por acá"
            description={
              filter === "ALL"
                ? "Cuando un capitán inscriba su equipo, aparecerá en esta bandeja."
                : `No hay inscripciones con estado "${ENROLLMENT_STATUS[filter].label}".`
            }
          />
        ) : (
          <AnimatePresence initial={false} mode="popLayout">
            {visible.map((enrollment) => (
              <EnrollmentRow
                key={enrollment.id}
                enrollment={enrollment}
                isBusy={busyEnrollmentId === enrollment.id}
                onApprove={(id) => approveMutation.mutate({ enrollmentId: id })}
                onReject={(id, reason) => rejectMutation.mutate({ enrollmentId: id, reason })}
                onDisapprove={(id) => disapproveMutation.mutate({ enrollmentId: id })}
              />
            ))}
          </AnimatePresence>
        )}
      </div>

      {canFinalize && (
        <div className="mt-8 space-y-3 border-t border-cypher-5-1-1 px-5 pt-6">
          <Button
            className="w-full"
            size="lg"
            disabled={counts.APPROVED < MIN_TEAMS_TO_DRAW || drawMutation.isPending}
            onClick={handleDrawClick}
          >
            {drawMutation.isPending
              ? "Sorteando…"
              : counts.APPROVED < MIN_TEAMS_TO_DRAW
                ? `Cerrar y sortear · ${counts.APPROVED}/${MIN_TEAMS_TO_DRAW} equipos`
                : confirmingDraw
                  ? `¿Confirmar sorteo con ${counts.APPROVED} equipos?`
                  : `Cerrar inscripciones y sortear · ${counts.APPROVED} equipos`}
          </Button>
          {counts.APPROVED < MIN_TEAMS_TO_DRAW && (
            <p className="text-center text-xs text-cypher-4-2">
              Necesitas al menos {MIN_TEAMS_TO_DRAW} equipos aprobados para sortear.
            </p>
          )}
          <Button
            variant="outline"
            className="w-full border-red-400/30 text-red-400 hover:bg-red-400/10 active:bg-red-400/15"
            disabled={cancelMutation.isPending}
            onClick={handleCancelClick}
          >
            {cancelMutation.isPending
              ? "Cancelando…"
              : confirmingCancel
                ? "¿Confirmar cancelación del torneo?"
                : "Cancelar torneo"}
          </Button>
          {confirmingCancel && (
            <p className="text-center text-xs text-cypher-4-2">
              Se archivarán todas las inscripciones de este torneo.
            </p>
          )}
        </div>
      )}

      <Toast toast={toast} />
    </div>
  );
}