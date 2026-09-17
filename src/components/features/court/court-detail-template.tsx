"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { CalendarDays, Clock, MapPin, Package, Plus, Trophy, Users } from "lucide-react";
import { api } from "torneos/trpc/react";
import { Button } from "torneos/components/ui/button/button";
import { Badge } from "torneos/components/ui/badge";
import { EmptyState } from "torneos/components/ui/empty-state";
import { LoadingSkeleton } from "torneos/components/ui/loading-skeleton";
import { CourtAvailabilityGrid } from "torneos/components/ui/court-availability-grid/court-availability-grid";
import { CreateTournamentModal } from "torneos/components/ui/tournament/create-tournament-modal";
import { dayLabel, slotLabel } from "torneos/domain/schedule/labels";
import { COURT_STATUS_LABEL, TOURNAMENT_STATUS_LABEL } from "torneos/domain/status-labels";

// W5 — Detalle público de cancha (destino del CTA "Ver Detalle" del hub).
// Jerarquía del mini-spec: CourtHero → Disponibilidad 7 días (matriz getBubble) →
// Torneos en esta cancha → [gestor] CTA Crear Torneo aquí.
// Branching de listas conservado: anónimo → listByCourtPublic (vitrina, sin DRAFT);
// logueado → listByCourt (el gestor ve DRAFT + Publicar).
// getBubble SOLO devuelve ENABLED (DISABLED → 404 en la page): la matriz pública
// no conoce el estado apagado. Errores de mutación INLINE (no hay API de toast
// invocable en el código — patrón W4 de confirmación/error inline).

interface CourtDetailTemplateProps {
  courtId: string;
  isLoggedIn: boolean;
}

function formatDeadline(value: Date | string): string {
  return new Date(value).toLocaleDateString("es-CO", {
    timeZone: "America/Bogota",
    day: "numeric",
    month: "short",
  });
}

export function CourtDetailTemplate({ courtId, isLoggedIn }: CourtDetailTemplateProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const utils = api.useUtils();

  // Read-model único del header + matriz (público, sirve a anónimos y logueados)
  const { data: court } = api.court.getBubble.useQuery({ courtId });

  const { data: publicTournaments, isLoading: isLoadingPublic } = api.tournament.listByCourtPublic.useQuery(
    { courtId },
    { enabled: !isLoggedIn },
  );

  const { data: managerTournaments, isLoading: isLoadingManager } = api.tournament.listByCourt.useQuery(
    { courtId },
    { enabled: isLoggedIn, retry: false },
  );

  // Perfil de gestor SOLO con sesión (evita 401-spam para anónimos)
  const { data: myManagerProfile } = api.admin.getMyManagerProfile.useQuery(undefined, {
    enabled: isLoggedIn,
    retry: false,
  });

  const tournaments = isLoggedIn ? managerTournaments : publicTournaments;
  const isLoadingTournaments = isLoggedIn ? isLoadingManager : isLoadingPublic;
  const isManager = !!myManagerProfile;

  const createMutation = api.tournament.create.useMutation({
    onSuccess: () => {
      setCreateError(null);
      setIsModalOpen(false);
      void utils.tournament.listByCourt.invalidate({ courtId });
    },
    onError: (error) => {
      // Franja ocupada / deadline pasada / validación del engine — inline en el modal
      setCreateError(error.message);
    },
  });

  const publishMutation = api.tournament.publish.useMutation({
    // Optimistic: el estado del row vuela a SCHEDULED en el mismo frame
    onMutate: async ({ tournamentId }) => {
      setPublishError(null);
      await utils.tournament.listByCourt.cancel({ courtId });
      const previous = utils.tournament.listByCourt.getData({ courtId });
      utils.tournament.listByCourt.setData({ courtId }, (old) =>
        old?.map((t) => (t.id === tournamentId ? { ...t, status: "SCHEDULED" as const } : t)),
      );
      return { previous };
    },
    onError: (error, _vars, ctx) => {
      if (ctx?.previous) utils.tournament.listByCourt.setData({ courtId }, ctx.previous);
      setPublishError(error.message);
    },
    onSettled: () => {
      void utils.tournament.listByCourt.invalidate({ courtId });
    },
  });

  const courtStatusMeta = court
    ? (COURT_STATUS_LABEL[court.status] ?? { label: court.status, variant: "neutral" as const })
    : null;

  return (
    <div className="pb-10">
      {/* ── CourtHero ── */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="px-5 pt-5"
      >
        {court && courtStatusMeta ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-2xl font-bold leading-tight text-cypher-4">{court.name}</h1>
              <Badge variant={courtStatusMeta.variant} status={courtStatusMeta.label} />
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-cypher-4-2">
              <MapPin size={14} className="shrink-0 text-cypher-4-2-2" />
              {court.address}
            </p>
            {court.description && <p className="mt-2 text-sm text-cypher-4-2-2">{court.description}</p>}
            {court.inventory && (
              <p className="mt-2 flex items-start gap-1.5 text-xs text-cypher-4-2-2">
                <Package size={14} className="mt-0.5 shrink-0" />
                <span>
                  <span className="font-medium text-cypher-4-2">Inventario:</span> {court.inventory}
                </span>
              </p>
            )}
          </>
        ) : (
          <LoadingSkeleton variant="card" />
        )}
      </motion.section>

      {/* ── Disponibilidad · próximos 7 días (la matriz que aterriza del bubble W1) ── */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.06 }}
        className="mt-7 px-5"
      >
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-cypher-4-2">
          Disponibilidad · próximos 7 días
        </h2>
        {court ? <CourtAvailabilityGrid days={court.days} /> : <LoadingSkeleton variant="card" />}
      </motion.section>

      {/* ── Torneos en esta cancha ── */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.12 }}
        className="mt-8 px-5"
      >
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-cypher-4-2">
          Torneos en esta cancha
        </h2>

        {publishError && (
          <p className="mb-3 rounded-xl border border-red-500/30 bg-cypher-5-1 px-3 py-2 text-xs text-red-400" role="alert">
            {publishError}
          </p>
        )}

        {isLoadingTournaments ? (
          <LoadingSkeleton variant="row" rows={3} />
        ) : tournaments && tournaments.length > 0 ? (
          <div className="space-y-3">
            {tournaments.map((t) => {
              const statusMeta =
                TOURNAMENT_STATUS_LABEL[t.status] ?? { label: t.status, variant: "neutral" as const };
              const approved = "_count" in t && t._count ? t._count.enrollments : 0;
              return (
                <div key={t.id} className="rounded-2xl border border-cypher-4/10 bg-cypher-5-1 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <Link href={`/torneos/${t.id}`} className="min-w-0 flex-1">
                      <h3 className="truncate font-semibold text-cypher-4 hover:underline">{t.name}</h3>
                    </Link>
                    <Badge variant={statusMeta.variant} status={statusMeta.label} />
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-cypher-4-2-2">
                    <span className="inline-flex items-center gap-1">
                      <Users size={13} /> {approved}/{t.maxTeams} equipos
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays size={13} /> {dayLabel(t.dayOfWeek)} · {slotLabel(t.timeSlot)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock size={13} /> Cierra {formatDeadline(t.enrollmentDeadline)}
                    </span>
                  </div>

                  {isManager && t.status === "DRAFT" && (
                    <Button
                      size="sm"
                      className="mt-3 w-full"
                      onClick={() => publishMutation.mutate({ tournamentId: t.id })}
                      disabled={publishMutation.isPending}
                    >
                      {publishMutation.isPending ? "Publicando..." : "Publicar torneo"}
                    </Button>
                  )}

                  {isManager && t.status === "SCHEDULED" && (
                    <Link href={`/torneos/${t.id}/gestion`} className="mt-3 block">
                      <Button size="sm" variant="secondary" className="w-full">
                        Gestionar inscripciones
                      </Button>
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={<Trophy className="size-6" />}
            title="Sin torneos por ahora"
            description={
              isManager
                ? "Crea el primer torneo de esta cancha."
                : "Vuelve pronto: los torneos aparecen aquí al publicarse."
            }
          />
        )}
      </motion.section>

      {/* ── CTA gestor ── */}
      {isManager && (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.18 }}
          className="mt-8 px-5"
        >
          <Button
            size="lg"
            className="w-full"
            onClick={() => {
              setCreateError(null);
              setIsModalOpen(true);
            }}
          >
            <Plus size={18} /> Crear torneo aquí
          </Button>
        </motion.section>
      )}

      <CreateTournamentModal
        courtId={courtId}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreate={(data) => createMutation.mutate(data)}
        submitError={createError}
      />
    </div>
  );
}