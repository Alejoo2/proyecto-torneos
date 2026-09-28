"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Inbox, SearchX, Users, ChevronDown, ChevronUp } from "lucide-react";
import { api } from "torneos/trpc/react";
import { Button } from "torneos/components/ui/button/button";
import { EmptyState } from "torneos/components/ui/empty-state";
import { LoadingSkeleton } from "torneos/components/ui/loading-skeleton";
import { Toast } from "torneos/components/ui/toast";
import { MatchHero } from "./match-hero";
import { PlayerGrid } from "./player-grid";
import { ResultReadout } from "./result-readout";
import { TERMINAL_MATCH_STATUS } from "./types";
import { useTournamentPowers } from "torneos/components/features/tournament/use-tournament-powers";

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

  const query = api.match.getByIdPublic.useQuery(
    { id: matchId },
    // Ficha pesada: 2 min fresca; sin refetch al enfocar.
    { retry: false, staleTime: 2 * 60_000, refetchOnWindowFocus: false },
  );
  const match = query.data?.match ?? null;
  const viewer = query.data?.viewer ?? null;
  // Link "Gestionar partido" por permiso (dueño o secretario con llaves),
  // no por rol: el backend niega igual, pero la UI no esconde lo permitido.
  const powers = useTournamentPowers(match?.tournamentId ?? null);

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

  // Selección con clave equipo:jugador (un jugador en los dos equipos no se
  // marca dos veces ni abre dos paneles).
  const [openKey, setOpenKey] = useState<string | null>(null);
  // Acordeón por equipo (como el wizard): colapsados al entrar.
  const [openTeamIds, setOpenTeamIds] = useState<Set<string>>(new Set());
  const toggleTeam = (teamId: string) => {
    setOpenTeamIds((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
  };
  const myAbsencesQuery = api.enrollment.listMyTournamentAbsences.useQuery(undefined, {
    // El toggle invalida vía refetch explícito (línea 84): 5 min + sin refetch al enfocar.
    retry: false,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  const markTournamentAbsent = api.enrollment.markTournamentAbsence.useMutation({
    onSuccess: () => {
      void myAbsencesQuery.refetch();
      notify("Ausencia marcada: saliste del conteo de este torneo");
    },
    onError: (e) => notify(e.message),
  });
  const clearTournamentAbsent = api.enrollment.clearTournamentAbsence.useMutation({
    onSuccess: () => {
      void myAbsencesQuery.refetch();
      notify("Volviste a este torneo");
    },
    onError: (e) => notify(e.message),
  });

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

  const myPlayerId = viewer?.playerId ?? null;
  const isAbsentTournament = (myAbsencesQuery.data ?? []).some((a) => a.tournamentId === match.tournamentId);

  // Secciones por RELACIÓN (homeTeam.id), no por FK: tras el guard TBD el FK sigue
  // tipado string | null (Prisma no correlaciona), la relación sí queda estrechada.
  // Locales const: el narrowing del guard no entra a los callbacks de filter
  // (propiedad mutable → TS re-ensancha en closures). Un const local sí se conserva.
  const homeTeam = match.homeTeam;
  const awayTeam = match.awayTeam;

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

        {/* Convocatoria por equipo con PlayerGrid: el tile abre un acordeón de
            fila completa. Ventana SOLO si eres capitán de ese equipo o es tu
            cell: el capitán confirma ausencias, uno mismo las suyas + torneo. */}
        {[homeTeam, awayTeam].map((team) => {
          const teamCallUps = match.callUps.filter((c) => c.teamId === team.id);
          if (teamCallUps.length === 0) return null;
          const isCaptainHere = viewer?.captainOfTeamIds.includes(team.id) ?? false;
          return (
            <section key={team.id}>
              <button
                type="button"
                aria-expanded={openTeamIds.has(team.id)}
                onClick={() => toggleTeam(team.id)}
                className="mb-2 flex w-full items-center justify-between text-left"
              >
                <span className="text-[11px] font-semibold uppercase tracking-wider text-cypher-4-2-2">
                  {team.name} · {teamCallUps.length}
                </span>
                {openTeamIds.has(team.id)
                  ? <ChevronUp className="size-3.5 text-cypher-4-2" />
                  : <ChevronDown className="size-3.5 text-cypher-4-2" />}
              </button>
              {openTeamIds.has(team.id) && (
              <PlayerGrid
                players={teamCallUps.map((c) => ({
                  playerId: c.playerId,
                  name: c.player.profile.displayName ?? "Jugador",
                  image: c.player.profile.user.image,
                  ready: c.isAbsent,
                }))}
                openPlayerId={openKey?.startsWith(`${team.id}:`) ? openKey.slice(team.id.length + 1) : null}
                onTogglePlayer={(playerId) => {
                  const key = `${team.id}:${playerId}`;
                  setOpenKey((prev) => (prev === key ? null : key));
                }}
                renderPanel={(p) => {
                  const c = teamCallUps.find((x) => x.playerId === p.playerId);
                  if (!c) return null;
                  const isSelf = c.playerId === myPlayerId;
                  const canAct = editable && (isCaptainHere || isSelf);
                  if (!canAct) return null;
                  const close = () => setOpenKey(null);
                  return (
                    <div className="col-span-full rounded-xl border border-cypher-5-1-1 bg-cypher-5 p-3">
                      <p className="text-sm text-cypher-4">
                        {isSelf && !isCaptainHere ? "Vas a " : "Este jugador va a "}
                        {c.isAbsent ? "estar presente" : "estar ausente"}
                        {!isSelf && ` en ${team.name}`}
                      </p>
                      {c.notes && (
                        <p className="mt-1 text-[11px] text-cypher-4-2-2">Nota: {c.notes}</p>
                      )}
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          disabled={markAbsentMutation.isPending}
                          onClick={() =>
                            markAbsentMutation.mutate(
                              {
                                matchId: match.id,
                                teamId: c.teamId,
                                playerId: c.playerId,
                                isAbsent: !c.isAbsent,
                              },
                              { onSuccess: close },
                            )
                          }
                          className="flex-1 rounded-xl bg-cypher-2 py-2.5 text-xs font-bold text-cypher-5 disabled:opacity-50"
                        >
                          Confirmar
                        </button>
                        <button
                          type="button"
                          onClick={close}
                          className="flex-1 rounded-xl bg-cypher-5-1-1 py-2.5 text-xs font-bold text-cypher-4-2"
                        >
                          Cancelar
                        </button>
                      </div>
                      {isSelf && (
                        <button
                          type="button"
                          disabled={markTournamentAbsent.isPending || clearTournamentAbsent.isPending}
                          onClick={() =>
                            isAbsentTournament
                              ? clearTournamentAbsent.mutate({ tournamentId: match.tournamentId })
                              : markTournamentAbsent.mutate({ tournamentId: match.tournamentId, teamId: c.teamId })
                          }
                          className="mt-2 w-full rounded-xl border border-red-400/30 bg-transparent py-2.5 text-xs font-bold text-red-300 disabled:opacity-50"
                        >
                          {isAbsentTournament ? "Volver a este torneo" : "Ausentarme de este torneo"}
                        </button>
                      )}
                    </div>
                  );
                }}
              />
              )}
            </section>
          );
        })}

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
        ) : match.callUps.length === 0 ? (
          <EmptyState
            icon={<Users className="size-8" />}
            title="Sin convocatoria publicada"
            description="Cuando el gestor convoque jugadores, aparecerán aquí."
          />
        ) : null}

        {powers.canEnterGestion && (
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