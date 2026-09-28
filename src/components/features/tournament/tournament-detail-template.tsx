"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ClipboardList, Lock, Trophy } from "lucide-react";
import { api } from "torneos/trpc/react";
import { TournamentHero } from "torneos/components/features/tournament/tournament-hero";
import { EnrollmentCta } from "torneos/components/features/tournament/enrollment-cta";
import { useTournamentPowers } from "torneos/components/features/tournament/use-tournament-powers";
import { BracketView } from "torneos/components/features/tournament/bracket-view";
import { StandingsTable } from "torneos/components/features/tournament/standings-table";
import { TabBar } from "torneos/components/ui/tab-bar";
import { EmptyState } from "torneos/components/ui/empty-state";
import { Toast } from "torneos/components/ui/toast";
import { LoadingSkeleton } from "torneos/components/ui/loading-skeleton";
import { buttonVariants } from "torneos/components/ui/button/button";
import { cn } from "torneos/lib/utils";

interface TournamentDetailTemplateProps {
  tournamentId: string;
  isLoggedIn: boolean;
  sessionUserId?: string | null;
}

const TABS = [
  { id: "fixture", label: "Fixture" },
  { id: "standings", label: "Posiciones" },
];

export function TournamentDetailTemplate({
  tournamentId,
  isLoggedIn,
  sessionUserId = null,
}: TournamentDetailTemplateProps) {
  const [tab, setTab] = useState<string>("fixture");
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");

  // Toast (protocolo 4.4): piel única del átomo — el texto informa, no el color.
  const [toast, setToast] = useState<{ title: string } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(id);
  }, [toast]);
  const notify = useCallback((title: string) => {
    setToast({ title });
  }, []);

  const utils = api.useUtils();
  const loginHref = `/login?callbackUrl=${encodeURIComponent(`/torneos/${tournamentId}`)}`;
  // Poderes por permiso (hook SIEMPRE arriba del return temprano: si no,
  // el conteo de hooks cambia entre loading y datos y React crashea).
  const powers = useTournamentPowers(isLoggedIn ? tournamentId : null);

  // ── Capa 2: lecturas ramificadas por sesión (frontera RSC en page.tsx) ──
  // Sin refetch al enfocar en ninguna (el regreso de pestaña no re-dispara el batch);
  // standings 5 min (loadResult invalida), resto vive del global 30s + invalidaciones.
  const publicQuery = api.tournament.getPublicById.useQuery({ tournamentId }, { enabled: !isLoggedIn, refetchOnWindowFocus: false });
  const managedQuery = api.tournament.getById.useQuery({ tournamentId }, { enabled: isLoggedIn, retry: false, refetchOnWindowFocus: false });
  const holdQuery = api.tournament.checkHold.useQuery(
    { tournamentId },
    // doc 8.3: refetch 15s SOLO mientras exista hold activo
    { enabled: isLoggedIn, retry: false, refetchInterval: (data) => (data ? 15_000 : false), refetchOnWindowFocus: false },
  );
  const myTeamsQuery = api.team.getMyTeams.useQuery(undefined, { enabled: isLoggedIn, retry: false, refetchOnWindowFocus: false });
  const myStatusQuery = api.enrollment.getMyStatus.useQuery({ tournamentId }, { enabled: isLoggedIn, retry: false, refetchOnWindowFocus: false });
  const matchesQuery = api.match.listByTournament.useQuery({ tournamentId }, { enabled: isLoggedIn, retry: false, staleTime: 2 * 60_000, refetchOnWindowFocus: false });
  const standingsAuthQuery = api.stats.getTournamentStandings.useQuery({ tournamentId }, { enabled: isLoggedIn, retry: false, staleTime: 5 * 60_000, refetchOnWindowFocus: false });
  const standingsPublicQuery = api.stats.getTournamentStandingsPublic.useQuery({ tournamentId }, { enabled: !isLoggedIn, staleTime: 5 * 60_000, refetchOnWindowFocus: false });

  const tournament = isLoggedIn ? managedQuery.data : publicQuery.data;
  const isLoading = isLoggedIn ? managedQuery.isLoading : publicQuery.isLoading;
  const dataUpdatedAt = isLoggedIn ? managedQuery.dataUpdatedAt : publicQuery.dataUpdatedAt;
    const standings = (isLoggedIn ? standingsAuthQuery.data : standingsPublicQuery.data) ?? [];
  const matches = matchesQuery.data ?? [];
  // C1: cada tab carga su skeleton propio — sin el flash del EmptyState
  // mientras su query vuela (el hero ya pintó con la ficha).
  const isLoadingMatches = matchesQuery.isLoading;
  const isLoadingStandings = isLoggedIn ? standingsAuthQuery.isLoading : standingsPublicQuery.isLoading;
  // Regla absoluta: solo el capitán inscribe; capitanía única por jugador.
  // Se pasa SOLO el equipo capitaneado: el dropdown jamás aparece.
  const teams = useMemo(
    () => (myTeamsQuery.data ?? []).filter((t) => t.isCaptain),
    [myTeamsQuery.data],
  );
  const myEnrollments = myStatusQuery.data ?? [];
  const holdData = holdQuery.data ?? null;
  // E6: invites PRIVATE de mis equipos (capitán). Sin aceptada no hay CTA.
  const myTeamInvitesQuery = api.enrollment.listMyTeamInvites.useQuery(undefined, {
    enabled: isLoggedIn,
    retry: false,
  });
  const myInviteForTournament = (myTeamInvitesQuery.data ?? []).find((i) => i.tournamentId === tournamentId) ?? null;
  const myInviteAccepted = myInviteForTournament?.status === "ACCEPTED";
  const myInvitePending = myInviteForTournament?.status === "PENDING";

  // serverTimestamp exacto sin esperar B-09: expiresAt − secondsRemaining = reloj del servidor
  const hold = holdData
    ? {
        expiresAt: new Date(holdData.expiresAt).getTime(),
        serverTimestamp: new Date(holdData.expiresAt).getTime() - holdData.secondsRemaining * 1000,
      }
    : null;

  const reconcileHold = useCallback(() => {
    void utils.tournament.checkHold.invalidate({ tournamentId });
  }, [utils, tournamentId]);

  // ── Capa 4: mutaciones (único punto tRPC del flujo CTA) ──
  const holdSlot = api.tournament.holdSlot.useMutation({
    onSuccess: () => reconcileHold(),
    onError: (e) => notify(e.message),
  });
  const enroll = api.enrollment.enroll.useMutation({
    onSuccess: (data) => {
      void utils.enrollment.getMyStatus.invalidate({ tournamentId });
      void utils.tournament.getById.invalidate({ tournamentId });
      reconcileHold();
            if (data.status === "PENDING_PAYMENT") notify("Inscripción enviada — pendiente de pago");
      else if (data.status === "PENDING_AVAILABILITY") notify("Disponibilidad insuficiente en tu plantilla");
    },
    onError: (e) => notify(e.message),
  });
  const reevaluate = api.enrollment.reevaluate.useMutation({
    onSuccess: () => {
      void utils.enrollment.getMyStatus.invalidate({ tournamentId });
      void utils.stats.getTournamentStandings.invalidate({ tournamentId });
      notify("Disponibilidad reevaluada");
    },
    onError: (e) => notify(e.message),
  });
  // S02 §8: auto-ausencia por torneo (superficie en el CTA, no solo bandeja).
  const myAbsencesQuery = api.enrollment.listMyTournamentAbsences.useQuery(undefined, {
    enabled: isLoggedIn,
    retry: false,
  });
  const absentTeamIds = (myAbsencesQuery.data ?? [])
    .filter((a) => a.tournamentId === tournamentId)
    .map((a) => a.teamId)
    .filter((t): t is string => t !== null);
  const markAbsentMutation = api.enrollment.markTournamentAbsence.useMutation({
    onSuccess: () => {
      void myAbsencesQuery.refetch();
      notify("Ausencia marcada: saliste del conteo de este torneo");
    },
    onError: (e) => notify(e.message),
  });
  const clearAbsenceMutation = api.enrollment.clearTournamentAbsence.useMutation({
    onSuccess: () => {
      void myAbsencesQuery.refetch();
      notify("Volviste a este torneo");
    },
    onError: (e) => notify(e.message),
  });

  // Auto-selección del primer equipo
  useEffect(() => {
    if (teams.length > 0 && !selectedTeamId) setSelectedTeamId(teams[0]!.id);
  }, [teams, selectedTeamId]);

  if (isLoading || !tournament) {
    return <LoadingSkeleton variant="card" rows={4} className="pt-14" />;
  }

  // Vitrina: solo APPROVED · getById: activas (APPROVED/PENDING_*)
  const enrolledCount = tournament.enrollments.length;
  const activeHolds = "slotHolds" in tournament._count ? tournament._count.slotHolds : 0;
  const isScheduled = tournament.status === "SCHEDULED";
  // Entry point "Gestionar": por permiso (dueño o secretario con llaves),
  // no por rol. Sin poderes no hay botón aunque el backend lo niegue igual.
  const canManage = powers.canEnterGestion;

  const ctaCommon = {
    teams,
    selectedTeamId,
    onSelectTeam: setSelectedTeamId,
    isHolding: holdSlot.isPending,
    onHold: () => holdSlot.mutate({ tournamentId }),
    hold,
    onExpire: reconcileHold,
    isEnrolling: enroll.isPending,
    onConfirmEnrollment: () => {
      if (selectedTeamId) enroll.mutate({ tournamentId, teamId: selectedTeamId });
    },
    enrollments: myEnrollments,
    isReevaluating: reevaluate.isPending,
    onReevaluate: (enrollmentId: string) => reevaluate.mutate({ enrollmentId }),
    pendingInvite: myInvitePending,
    absentTeamIds,
    onMarkAbsent: (teamId: string) => markAbsentMutation.mutate({ tournamentId, teamId }),
    onClearAbsence: () => clearAbsenceMutation.mutate({ tournamentId }),
    isActingAbsence: markAbsentMutation.isPending || clearAbsenceMutation.isPending,
  };

  const showHoldCta = isLoggedIn && isScheduled && hold !== null;
  const showEnrolledCta = myEnrollments.length > 0;
  const isPrivate = "type" in tournament && tournament.type === "PRIVATE";
  const showReadyCta = isLoggedIn && isScheduled && !holdData && myEnrollments.length === 0 && teams.length > 0 && (!isPrivate || myInviteAccepted);
  const showNoTeamCta = isLoggedIn && isScheduled && !holdData && myEnrollments.length === 0 && teams.length === 0 && !isPrivate;
  const showPrivateCta = isLoggedIn && isScheduled && isPrivate && myEnrollments.length === 0 && teams.length > 0 && !myInviteAccepted;
  const showAnonCta = !isLoggedIn && isScheduled;

  return (
    <div className="pb-nav-safe pt-14">
      {/* ⚠ VERIFICAR contra vitrineCardSelect (nota B-15): si la vitrina no expone
          dayOfWeek/timeSlot/maxTeams/enrollmentDeadline, este mapeo anónimo es el
          punto exacto donde el compilador lo dirá. */}
      <TournamentHero
        name={tournament.name}
        status={tournament.status}
        format={tournament.format}
        courtName={tournament.court.name}
        dayOfWeek={tournament.dayOfWeek}
        timeSlot={tournament.timeSlot}
        enrollmentDeadline={tournament.enrollmentDeadline}
        startDate={tournament.startDate ?? null}
        enrolledCount={enrolledCount}
        maxTeams={tournament.maxTeams}
        activeHolds={activeHolds}
        dataUpdatedAt={dataUpdatedAt}
      />

      {/* Zona CTA — PANTALLA 2: A/B/C/D (estado C inline, decisión D1) */}
      {(showAnonCta || showNoTeamCta || showReadyCta || showHoldCta || showEnrolledCta || showPrivateCta) && (
        <div className="mt-4 space-y-4 px-5">
          {showHoldCta && <EnrollmentCta variant="HOLDING" {...ctaCommon} />}
          {showEnrolledCta && <EnrollmentCta variant="ENROLLED" {...ctaCommon} />}
          {showReadyCta && <EnrollmentCta variant="READY" {...ctaCommon} />}
          {showNoTeamCta && <EnrollmentCta variant="NO_TEAM" />}
          {showPrivateCta && <EnrollmentCta variant="PRIVATE" {...ctaCommon} />}
          {showAnonCta && <EnrollmentCta variant="ANON" loginHref={loginHref} />}
        </div>
      )}

            {canManage && (
        <div className="mt-4 px-5">
          <Link
            href={`/torneos/${tournamentId}/gestion`}
            className={cn(buttonVariants({ variant: "secondary" }), "w-full")}
          >
            <ClipboardList className="size-4" />
            Gestionar inscripciones
          </Link>
        </div>
      )}
      <div className="px-5 pt-6">
        <TabBar tabs={TABS} active={tab} onChange={setTab} />
      </div>

      <div className="px-5 pb-8 pt-4">
        {tab === "fixture" &&
          (!isLoggedIn ? (
            // D2: no existe listByTournamentPublic (nota B-13) — honesto: EmptyState + login
            <EmptyState
              icon={<Lock className="size-8" />}
              title="Fixture para usuarios"
              description="Inicia sesión para ver partidos y fases del torneo."
              action={
                <Link href={loginHref} className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}>
                  Iniciar sesión
                </Link>
              }
            />
          ) : isLoadingMatches ? (
            <div className="flex flex-col gap-2">
              <LoadingSkeleton />
              <LoadingSkeleton />
              <LoadingSkeleton />
            </div>
          ) : matches.length === 0 ? (
            <EmptyState
              icon={<Trophy className="size-8" />}
              title="Fixture por definir"
              description="Los partidos aparecen cuando el gestor realiza el sorteo."
            />
          ) : (
<BracketView matches={matches} matchHrefBase={`/torneos/${tournamentId}/partidos`} />          ))}
        {tab === "standings" &&
          (isLoadingStandings ? (
            <div className="flex flex-col gap-2">
              <LoadingSkeleton />
              <LoadingSkeleton />
              <LoadingSkeleton />
            </div>
          ) : standings.length === 0 ? (
            <EmptyState
              icon={<Trophy className="size-8" />}
              title="Sin posiciones aún"
              description="La tabla se genera con el primer partido jugado."
            />
          ) : (
            <StandingsTable rows={standings} />
          ))}
      </div>

            <Toast toast={toast} />
    </div>
  );
}