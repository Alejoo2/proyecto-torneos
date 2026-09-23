"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Inbox, Lock, SearchX } from "lucide-react";
import { api } from "torneos/trpc/react";
import { Badge } from "torneos/components/ui/badge";
import { Button } from "torneos/components/ui/button/button";
import { EmptyState } from "torneos/components/ui/empty-state";
import { LoadingSkeleton } from "torneos/components/ui/loading-skeleton";
import { Toast } from "torneos/components/ui/toast";
import { MatchHero } from "./match-hero";
import { MatchActionsPanel } from "./match-actions-panel";
import { RefereeSelect } from "./referee-select";
import { ResultWizard, resultDraftKey, type ResultPayload } from "./result-wizard";
import { ResultReadout } from "./result-readout";
import { TERMINAL_MATCH_STATUS } from "./types";

export function ManagerMatchTemplate({ matchId }: { matchId: string }) {
  const utils = api.useUtils();
  const [toast, setToast] = useState<{ title: string } | null>(null);
  // Paso del wizard: el selector de árbitro solo vive en el paso score
  const [wizardStep, setWizardStep] = useState<"score" | "stats">("score");

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);
  const notify = useCallback((title: string) => setToast({ title }), []);

  const matchQuery = api.match.getById.useQuery({ id: matchId }, { retry: false });
  // managerProcedure: datos del selector Y sonda RBAC honesta — el FORBIDDEN de un
  // no-gestor solo llega por acá (getById es protected: pasa cualquier autenticado).
  const refereesQuery = api.match.listReferees.useQuery(undefined, { retry: false });

  const match = matchQuery.data ?? null;
  const editable = match ? !(TERMINAL_MATCH_STATUS as readonly string[]).includes(match.status) : false;

  const assignRefereeMutation = api.match.assignReferee.useMutation({
    onMutate: async ({ refereeId }) => {
      await utils.match.getById.cancel({ id: matchId });
      const prev = utils.match.getById.getData({ id: matchId });
      // Optimistic honesto: no fabricamos la fila Referee; referee=null + refereeId
      // → el hero resuelve el nombre desde listReferees durante la ventana.
      utils.match.getById.setData({ id: matchId }, (old) =>
        old ? { ...old, referee: null, refereeId } : old,
      );
      return { prev };
    },
    onSuccess: () => notify("Árbitro actualizado"),
    onError: (e, _vars, ctx) => {
      if (ctx?.prev) utils.match.getById.setData({ id: matchId }, ctx.prev);
      notify(e.message);
    },
    onSettled: () => void utils.match.getById.invalidate({ id: matchId }),
  });

  // Carga de resultado: commit-style (el engine recalcula standings/stats/bracket en
  // cascada). Reconciliación GRUESA al asentarse (protocolo 4.4).
  const loadResultMutation = api.result.load.useMutation({
    onSuccess: () => {
      window.localStorage.removeItem(resultDraftKey(matchId)); // limpia el borrador
      notify("Resultado cargado — tabla y estadísticas actualizadas");
      void utils.match.getById.invalidate({ id: matchId });
      void utils.match.getByIdPublic.invalidate({ id: matchId });
      if (match) {
        void utils.match.listByTournament.invalidate({ tournamentId: match.tournamentId });
        void utils.tournament.getById.invalidate({ tournamentId: match.tournamentId });
        void utils.stats.getTournamentStandings.invalidate({ tournamentId: match.tournamentId });
      }
    },
    onError: (e) => notify(e.message),
  });

  if (matchQuery.isLoading) {
    return <LoadingSkeleton variant="card" rows={4} className="pt-14" />;
  }

  // getById (protected) no rechaza a un jugador-logueado: el FORBIDDEN real de un
  // no-gestor llega por listReferees. Ambos errores cuentan para el gate.
  if (matchQuery.error?.data?.code === "FORBIDDEN" || refereesQuery.error?.data?.code === "FORBIDDEN") {
    return (
      <div className="pb-nav-safe pt-14">
        <div className="px-5 pt-10">
          <EmptyState
            icon={<Lock className="size-8" />}
            title="Sin acceso"
            description="Solo el gestor de este torneo puede gestionar el partido."
          />
        </div>
      </div>
    );
  }

  if (matchQuery.isError) {
    return (
      <div className="pb-nav-safe pt-14">
        <div className="px-5 pt-10">
          <EmptyState
            icon={<Inbox className="size-8" />}
            title="No se pudo cargar el partido"
            description="Revisa tu conexión e intenta de nuevo."
            action={
              <Button size="sm" variant="secondary" onClick={() => void matchQuery.refetch()}>
                Reintentar
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="pb-nav-safe pt-14">
        <div className="px-5 pt-10">
          <EmptyState icon={<SearchX className="size-8" />} title="Partido no encontrado" />
        </div>
      </div>
    );
  }

  // Sin equipos aún no hay árbitro, convocatoria ni resultado que gestionar
  if (!match.homeTeam || !match.awayTeam) {
    return (
      <div className="pb-nav-safe pt-14">
        <div className="px-5 pt-10">
          <EmptyState
            icon={<SearchX className="size-8" />}
            title="Partido por definir"
            description="Los equipos se confirman cuando se jueguen las fases anteriores."
          />
        </div>
      </div>
    );
  }

  const showForm = editable && !match.result;

  return (
    <div className="pb-nav-safe pt-14">
      <header className="px-5 pt-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-widest text-cypher-4-2-2">Gestión · Partido</p>
          <Link
            href={`/torneos/${match.tournamentId}/gestion`}
            className="text-xs font-medium text-cypher-4-2 underline-offset-2 hover:underline"
          >
            Inscripciones
          </Link>
        </div>
        <h1 className="mt-1 truncate text-xl font-bold text-cypher-4">
          {match.homeTeam.abbreviation} vs {match.awayTeam.abbreviation}
        </h1>
      </header>

      <div className="mt-4 space-y-4 px-5">
        <MatchHero
          status={match.status}
          homeTeam={match.homeTeam}
          awayTeam={match.awayTeam}
          result={match.result}
          scheduledAt={match.scheduledAt}
          date={match.date}
          timeSlot={match.timeSlot}
          phaseName={match.phase?.name ?? null}
          courtName={match.court?.name ?? null}
          refereeName={match.referee?.name ?? (match.refereeId ? refereesQuery.data?.find((r) => r.id === match.refereeId)?.name ?? null : null)}
        />

        {/* W11 — E2: aplazar / reprogramar / paseo (gestor y secretario) */}
        {editable && <MatchActionsPanel match={match} onNotify={notify} />}        />

        {match.result ? (
          <ResultReadout
            homeScore={match.result.homeScore}
            awayScore={match.result.awayScore}
            notes={match.result.notes}
            sections={match.playerStats
              .map((s) => ({
                teamId: s.teamId,
                teamName: s.team.name,
                stats: match.playerStats.filter((x) => x.teamId === s.teamId),
              }))
              .filter((section, i, arr) => arr.findIndex((x) => x.teamId === section.teamId) === i)}
          />
        ) : showForm ? (
          <>
            {/* Árbitro solo en el paso score (QA: no se repite en la zona de stats) */}
            {wizardStep === "score" && (
              <RefereeSelect
                referees={refereesQuery.data ?? []}
                valueId={match.refereeId}
                disabled={!editable || assignRefereeMutation.isPending}
                isPending={assignRefereeMutation.isPending}
                onChange={(refereeId) => assignRefereeMutation.mutate({ matchId: match.id, refereeId })}
              />
            )}
            <ResultWizard
              key={match.id}
              matchId={match.id}
              homeTeam={match.homeTeam}
              awayTeam={match.awayTeam}
              callUps={match.callUps}
              isPending={loadResultMutation.isPending}
              onStepChange={setWizardStep}
              onSubmit={(payload: ResultPayload) => loadResultMutation.mutate({ matchId: match.id, ...payload })}
            />
          </>
        ) : (
          <div className="rounded-2xl bg-cypher-5-1 p-4 text-center">
            <Badge variant="warning" status="Partido sin resultado cargable" />
          </div>
        )}
      </div>

      <Toast toast={toast} />
    </div>
  );
}