"use client";
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "motion/react";
import { Inbox, Lock } from "lucide-react";
import { api } from "torneos/trpc/react";
import { EnrollmentRow } from "torneos/components/features/tournament/enrollment-row";
import { useTournamentPowers } from "torneos/components/features/tournament/use-tournament-powers";
import {
  ManagerFilterBar,
  type EnrollmentFilter,
} from "torneos/components/features/tournament/manager-filter-bar";
import { Badge } from "torneos/components/ui/badge";
import { Button } from "torneos/components/ui/button/button";
import { ConfirmModal } from "torneos/components/ui/confirm-modal/confirm-modal";
import { EmptyState } from "torneos/components/ui/empty-state";
import { LoadingSkeleton } from "torneos/components/ui/loading-skeleton";
import { Toast } from "torneos/components/ui/toast";
import {
  ENROLLMENT_STATUS,
  TOURNAMENT_STATUS,
  type EnrollmentStatus,
} from "torneos/domain/status-labels";

const MIN_TEAMS_TO_DRAW = 2; // precondición presentacional del sorteo (el engine es la verdad)

// F-1: el toast vive en este template — darle aire antes de la ceremonia (redirect al bracket).
const DRAW_REDIRECT_DELAY_MS = 1800;

export function ManagerEnrollmentsTemplate({ tournamentId }: { tournamentId: string }) {
  // Sorteo/cancelación: solo el dueño (no delegable). La bandeja la ve
  // cualquiera con enrollment:manage (el backend ya lo autoriza).
  const powers = useTournamentPowers(tournamentId);
  const router = useRouter();
  const utils = api.useUtils();

  // ── Invitar equipos (solo PRIVATE, con enrollment:manage) ──
  // Todo hook arriba de los returns tempranos (isLoading/FORBIDDEN/isError):
  // si no, el conteo cambia entre renders y React crashea.
  const [inviteQuery, setInviteQuery] = useState("");
  // C2: difiere la búsqueda para no disparar 1 request por tecla.
  const deferredInviteQuery = useDeferredValue(inviteQuery);
  const searchTeamsQuery = api.enrollment.searchTeamsForInvite.useQuery(
    { tournamentId, query: deferredInviteQuery },
    { enabled: deferredInviteQuery.trim().length >= 2, retry: false, refetchOnWindowFocus: false },
  );
  const invitesQuery = api.enrollment.listTournamentInvites.useQuery(
    { tournamentId },
    // Refetch explícito tras invitar/retirar: 2 min + sin refetch al enfocar.
    { retry: false, staleTime: 2 * 60_000, refetchOnWindowFocus: false },
  );
  const inviteTeamMutation = api.enrollment.inviteTeam.useMutation({
    onSuccess: () => {
      setInviteQuery("");
      void invitesQuery.refetch();
      notify("Invitación enviada");
    },
    onError: (e) => notify(e.message),
  });
  const revokeInviteMutation = api.enrollment.revokeTeamInvite.useMutation({
    onSuccess: () => {
      void invitesQuery.refetch();
      notify("Invitación retirada");
    },
    onError: (e) => notify(e.message),
  });

  const [filter, setFilter] = useState<EnrollmentFilter>("ALL");
  const [toast, setToast] = useState<{ title: string } | null>(null);
  const [drawModalOpen, setDrawModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);

  // Toast (protocolo 4.4): piel única del átomo — el texto informa, no el color.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);
  const notify = useCallback((title: string) => setToast({ title }), []);

  // Contexto: nombre + estado del torneo (define si siguen vivas las acciones finales)
  const tournamentQuery = api.tournament.getById.useQuery(
    { tournamentId },
    { retry: false, refetchOnWindowFocus: false },
  );

  // Fuente única: "ALL" en cache, filtrado 100% cliente (una sola cache key)
  const LIST_INPUT = useMemo(() => ({ tournamentId, status: "ALL" as const }), [tournamentId]);
  const listQuery = api.enrollment.listByTournament.useQuery(
    LIST_INPUT,
    // Aprobar/rechazar invalidan: 2 min + sin refetch al enfocar.
    { retry: false, staleTime: 2 * 60_000, refetchOnWindowFocus: false },
  );
  // Rojo por equipo (gestor y secretarios con llave lo ven igual).
  // Lo editan terceros (disponibilidad de jugadores): solo sin refetch al enfocar.
  const conflictsQuery = api.tournament.getEnrollmentConflicts.useQuery(
    { tournamentId },
    { retry: false, refetchOnWindowFocus: false },
  );
  const conflictByTeam = useMemo(() => {
    const map = new Map<string, { hardCount: number; hardNames: string[] }>();
    for (const c of conflictsQuery.data ?? []) map.set(c.teamId, c);
    return map;
  }, [conflictsQuery.data]);

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

  // F-1: toast visible ANTES de navegar — el push se difiere y el toast respira.
  // Nota: si el usuario navega por su cuenta en la ventana del delay, el push
  // posterior es benigno (mismo destino ya sorteado).
  const drawMutation = api.tournament.closeAndDraw.useMutation({
    onSuccess: () => {
      notify("Sorteo ejecutado — torneo en curso");
      void utils.tournament.getById.invalidate({ tournamentId });
      void utils.match.listByTournament.invalidate({ tournamentId });
      // El sorteo confirma reservas (morado) en la matriz de la cancha.
      const drawCourtId = tournamentQuery.data?.courtId;
      if (drawCourtId) void utils.court.getBubble.invalidate({ courtId: drawCourtId });
      window.setTimeout(() => router.push(`/torneos/${tournamentId}`), DRAW_REDIRECT_DELAY_MS);
    },
    onError: (e) => notify(e.message),
  });

  const cancelMutation = api.tournament.cancel.useMutation({
    onSuccess: () => {
      notify("Torneo cancelado");
      void utils.tournament.getById.invalidate({ tournamentId });
      window.setTimeout(() => router.push(`/torneos/${tournamentId}`), DRAW_REDIRECT_DELAY_MS);
    },
    onError: (e) => notify(e.message),
  });

  // La mutación en vuelo deshabilita SOLO su fila
  const busyEnrollmentId =
    (approveMutation.isPending && approveMutation.variables?.enrollmentId) ||
    (rejectMutation.isPending && rejectMutation.variables?.enrollmentId) ||
    (disapproveMutation.isPending && disapproveMutation.variables?.enrollmentId) ||
    null;

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

  const canInvite = powers.isOwner || powers.can("enrollment:manage");
  const showInviteSection = tournament?.type === "PRIVATE" && canInvite;

  // Sortear/cancelar solo tienen sentido antes de que arranque
  const canFinalize = tournament?.status === "SCHEDULED" || tournament?.status === "GRACE_PERIOD";

  // F-1: el bracket de eliminación se construye con potencias de 2 (2, 4, 8, 16…).
  const approvedCount = counts.APPROVED;
  const isPowerOfTwo = approvedCount >= MIN_TEAMS_TO_DRAW && (approvedCount & (approvedCount - 1)) === 0;
  const drawHint = !isPowerOfTwo
    ? approvedCount < MIN_TEAMS_TO_DRAW
      ? `Necesitas al menos ${MIN_TEAMS_TO_DRAW} equipos aprobados para sortear.`
      : `El bracket requiere una potencia de 2 (2, 4, 8…): tienes ${approvedCount}. Aprueba o rechaza inscripciones hasta llegar a la potencia más cercana.`
    : null;

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
                hardCount={conflictByTeam.get(enrollment.teamId)?.hardCount ?? 0}
                hardNames={conflictByTeam.get(enrollment.teamId)?.hardNames ?? []}
                onApprove={(id) => approveMutation.mutate({ enrollmentId: id })}
                onReject={(id, reason) => rejectMutation.mutate({ enrollmentId: id, reason })}
                onDisapprove={(id) => disapproveMutation.mutate({ enrollmentId: id })}
              />
            ))}
          </AnimatePresence>
        )}
      </div>

      {showInviteSection && (
        <div className="mt-8 space-y-3 border-t border-cypher-5-1-1 px-5 pt-6">
          <p className="text-xs font-medium uppercase tracking-widest text-cypher-4-2-2">
            Invitar equipos (privado)
          </p>
          <input
            type="text"
            placeholder="Buscar equipo por nombre (mín. 2 letras)"
            value={inviteQuery}
            onChange={(e) => setInviteQuery(e.target.value)}
            className="w-full rounded-xl border border-cypher-5-1-1 bg-cypher-5-1-1 px-3 py-2 text-sm text-cypher-4 outline-none placeholder:text-cypher-4-2-2 focus:border-cypher-4-2"
          />
          {searchTeamsQuery.data && searchTeamsQuery.data.length > 0 && (
            <div className="space-y-1.5">
              {searchTeamsQuery.data.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-2 rounded-xl bg-cypher-5-1 px-3 py-2">
                  <span className="truncate text-sm text-cypher-4">{t.name}</span>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={inviteTeamMutation.isPending}
                    onClick={() => inviteTeamMutation.mutate({ tournamentId, teamId: t.id })}
                  >
                    Invitar
                  </Button>
                </div>
              ))}
            </div>
          )}
          {(invitesQuery.data ?? []).map((inv) => (
            <div key={inv.id} className="flex items-center justify-between gap-2 rounded-xl bg-cypher-5-1 px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-sm text-cypher-4">
                {inv.team.name} · <span className="text-cypher-4-2-2">{inv.status}</span>
              </span>
              {inv.status === "PENDING" && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={revokeInviteMutation.isPending}
                  onClick={() => revokeInviteMutation.mutate({ inviteId: inv.id })}
                >
                  Retirar
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {canFinalize && powers.isOwner && (
        <div className="mt-8 space-y-3 border-t border-cypher-5-1-1 px-5 pt-6">
          <Button
            className="w-full"
            size="lg"
            // Hallazgo E2E (copa completa): el approve es optimistic — sortear con
            // approves en vuelo dibujaba un bracket con menos equipos de los
            // mostrados. El botón espera a que asienten todas las mutaciones.
            disabled={
              !isPowerOfTwo ||
              drawMutation.isPending ||
              approveMutation.isPending ||
              rejectMutation.isPending ||
              disapproveMutation.isPending
            }
            onClick={() => setDrawModalOpen(true)}
          >
            {drawMutation.isPending
              ? "Sorteando…"
              : `Cerrar inscripciones y sortear · ${approvedCount} equipos`}
          </Button>
          {drawHint && <p className="text-center text-xs text-cypher-4-2">{drawHint}</p>}

          <Button
            variant="outline"
            className="w-full border-red-400/30 text-red-400 hover:bg-red-400/10 active:bg-red-400/15"
            disabled={cancelMutation.isPending}
            onClick={() => setCancelModalOpen(true)}
          >
            {cancelMutation.isPending ? "Cancelando…" : "Cancelar torneo"}
          </Button>
        </div>
      )}

      <ConfirmModal
        isOpen={drawModalOpen}
        title="Cerrar inscripciones y sortear"
        message={`Se cierran las inscripciones y se genera el bracket con ${approvedCount} equipos.\n\nLos equipos no aprobados quedan fuera. Esta acción es irreversible.`}
        confirmText={`Sortear con ${approvedCount}`}
        onCancel={() => setDrawModalOpen(false)}
        onConfirm={() => {
          setDrawModalOpen(false);
          drawMutation.mutate({ tournamentId });
        }}
      />

      <ConfirmModal
        isOpen={cancelModalOpen}
        title="Cancelar torneo"
        message={"Se cancela el torneo y se archivan todas sus inscripciones.\n\nEsta acción es irreversible."}
        confirmText="Cancelar torneo"
        variant="danger"
        onCancel={() => setCancelModalOpen(false)}
        onConfirm={() => {
          setCancelModalOpen(false);
          cancelMutation.mutate({ tournamentId });
        }}
      />

      <Toast toast={toast} />
    </div>
  );
}