"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Inbox, SearchX, Users } from "lucide-react";
import { api } from "torneos/trpc/react";
import { Button } from "torneos/components/ui/button/button";
import { EmptyState } from "torneos/components/ui/empty-state";
import { LoadingSkeleton } from "torneos/components/ui/loading-skeleton";
import { Toast } from "torneos/components/ui/toast";
import { MatchHero } from "./match-hero";
import { CallupList, type CallupSection } from "./callup-list";
import { CaptainAbsenteePanel } from "./captain-absentee-panel";
import { ResultReadout } from "./result-readout";
import { TERMINAL_MATCH_STATUS, type CallUpItem } from "./types";

export function PublicMatchTemplate({ matchId }: { matchId: string }) {
  const utils = api.useUtils();
  const [toast, setToast] = useState<{ title: string } | null>(null);

  // Toast (protocolo W3): piel única, 3000ms
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);
  const notify = useCallback((title: string) => setToast({ title }), []);

  const query = api.match.getByIdPublic.useQuery({ id: matchId }, { retry: false });
  const match = query.data?.match ?? null;
  const viewer = query.data?.viewer ?? null;

  // Espejo del engine: EDITABLE_BLOCKERS (POSTPONED mantiene acciones vivas)
  const editable = match ? !(TERMINAL_MATCH_STATUS as readonly string[]).includes(match.status) : false;

  // Optimistic (protocolo 4.4) sobre la única cache key de esta pantalla
  const markAbsentMutation = api.match.markAbsent.useMutation({
    onMutate: async ({ playerId, isAbsent, notes }) => {
      await utils.match.getByIdPublic.cancel({ id: matchId });
      const prev = utils.match.getByIdPublic.getData({ id: matchId });
      utils.match.getByIdPublic.setData({ id: matchId }, (old) => {
        if (!old?.match) return old;
        return {
          ...old,
          match: {
            ...old.match,
            callUps: old.match.callUps.map((c) =>
              c.playerId === playerId ? { ...c, isAbsent, notes: notes ?? c.notes } : c,
            ),
          },
        };
      });
      return { prev };
    },
    onSuccess: () => notify("Convocatoria actualizada"),
    onError: (e, _vars, ctx) => {
      if (ctx?.prev) utils.match.getByIdPublic.setData({ id: matchId }, ctx.prev);
      notify(e.message);
    },
    onSettled: () => void utils.match.getByIdPublic.invalidate({ id: matchId }),
  });

  const busyPlayerId =
    (markAbsentMutation.isPending && markAbsentMutation.variables?.playerId) || null;

  if (query.isLoading) {
    return <LoadingSkeleton variant="card" rows={4} className="pt-14" />;
  }

  if (query.isError) {
    return (
      <div className="pb-nav-safe pt-14">
        <div className="px-5 pt-10">
          <EmptyState
            icon={<Inbox className="size-8" />}
            title="No se pudo cargar el partido"
            description="Revisa tu conexión e intenta de nuevo."
            action={
              <Button size="sm" variant="secondary" onClick={() => void query.refetch()}>
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

  // Bracket TBD: los FK pueden ser null (seed: partidos con equipos sin definir)
  if (!match.homeTeam || !match.awayTeam) {
    return (
      <div className="pb-nav-safe pt-14">
        <div className="px-5 pt-10">
          <EmptyState
            icon={<Users className="size-8" />}
            title="Partido por definir"
            description="Los equipos se confirman cuando se jueguen las fases anteriores."
          />
        </div>
      </div>
    );
  }

  const captainTeamId =
    viewer?.captainOfTeamIds.find(
      (id) => id === match.homeTeamId || id === match.awayTeamId,
    ) ?? null;
  const homeIsCaptain = captainTeamId === match.homeTeamId;
  const myTeam = homeIsCaptain ? match.homeTeam : match.awayTeam;
  const myCallUps: CallUpItem[] =
    captainTeamId ? match.callUps.filter((c) => c.teamId === captainTeamId) : [];

  // Secciones por RELACIÓN (homeTeam.id), no por FK: tras el guard TBD el FK sigue
  // tipado string | null (Prisma no correlaciona), la relación sí queda estrechada.
    // Locales const: el narrowing del guard no entra a los callbacks de filter
  // (propiedad mutable → TS re-ensancha en closures). Un const local sí se conserva.
  const homeTeam = match.homeTeam;
  const awayTeam = match.awayTeam;

  const sections: CallupSection[] = [
    {
      teamId: homeTeam.id,
      teamName: homeTeam.name,
      players: match.callUps.filter((c) => c.teamId === homeTeam.id),
    },
    {
      teamId: awayTeam.id,
      teamName: awayTeam.name,
      players: match.callUps.filter((c) => c.teamId === awayTeam.id),
    },
  ].filter((s) => s.players.length > 0);

  return (
    <div className="pb-nav-safe pt-14">
      <header className="px-5 pt-4">
        <p className="text-xs font-medium uppercase tracking-widest text-cypher-4-2-2">Partido</p>
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
          refereeName={match.referee?.name ?? null}
        />

        {/* Vista Capitán: capitán VIGENTE de uno de los dos equipos + partido no terminal */}
        {captainTeamId && editable && myTeam && (
          <CaptainAbsenteePanel
            teamName={myTeam.name}
            callUps={myCallUps}
            busyPlayerId={busyPlayerId}
            onToggle={(c, isAbsent) =>
              markAbsentMutation.mutate({
                matchId: match.id, playerId: c.playerId, isAbsent, notes: c.notes ?? undefined,
              })
            }
            onNotesCommit={(c, notes) =>
              markAbsentMutation.mutate({
                matchId: match.id, playerId: c.playerId, isAbsent: c.isAbsent, notes,
              })
            }
          />
        )}

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
        ) : sections.length > 0 ? (
          <CallupList sections={sections} />
        ) : (
          <EmptyState
            icon={<Users className="size-8" />}
            title="Sin convocatoria publicada"
            description="Cuando el gestor convoque jugadores, aparecerán aquí."
          />
        )}

        {viewer?.isManager && (
          <Link
            href={`/gestor/torneos/${match.tournamentId}/partidos/${match.id}`}
            className="block rounded-xl border border-cypher-5-1-1 px-4 py-2.5 text-center text-xs font-semibold text-cypher-4-2 active:bg-cypher-5-1-1"
          >
            Gestionar partido
          </Link>
        )}
      </div>

      <Toast toast={toast} />
    </div>
  );
}