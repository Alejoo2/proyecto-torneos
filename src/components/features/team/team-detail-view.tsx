"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { LogIn, SearchX, ShieldOff, UserPlus } from "lucide-react";
import { HeaderTitle } from "torneos/components/app-shell/header-title";
import { Badge } from "torneos/components/ui/badge";
import { EmptyState } from "torneos/components/ui/empty-state";
import { LoadingSkeleton } from "torneos/components/ui/loading-skeleton";
import { Toast } from "torneos/components/ui/toast";
import { TEAM_STATUS_LABEL } from "torneos/domain/status-labels";
import { TacticalView } from "torneos/components/features/team/tactical-view";
import { StarterTile } from "torneos/components/features/team/starter-tile";
import { AvailabilityMatrix } from "torneos/components/ui/availability-matrix/availability-matrix";
import { PlayerGrid } from "torneos/components/features/match/player-grid";
import { DeletionBanner } from "torneos/components/ui/deletion-banner/deletion-banner";
import { ConfirmModal } from "torneos/components/ui/confirm-modal/confirm-modal";
import {
  useConfirmDelete,
  useGetTeamById,
  useLeaveTeam,
  useRequestDelete,
  useSetStarter,
  useSuggestedSlots,
  useSetSuggestedSlots,
  useRequestTransfer,
  usePendingTransfers,
  useAcceptTransfer,
  useRejectTransfer,
} from "torneos/components/features/team/use-team";

interface Props {
  teamId: string;
}

const MAX_STARTERS = 5;

/** W8.2 — Detalle de equipo. Estructura del wireframe: Previsualización (cancha
 *  horizontal) → Cancha (mosaico + contador N/5) → Banco (mosaico + contador).
 *  isStarter NO es fuente de verdad de habilitados para torneo/partido en vivo
 *  (eso es la convocatoria del partido): los textos jamás lo prometen. */
export function TeamDetailView({ teamId }: Props) {
  const { data: session } = useSession();
  const isLoggedIn = Boolean(session?.user);
  const { data: team, isLoading, isError, refetch } = useGetTeamById(teamId);

  const [toast, setToast] = useState<{ title: string } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);
  const notify = (title: string) => setToast({ title });

  const { mutate: leaveTeam, isPending: isLeaving, error: leaveError } = useLeaveTeam();
  const { mutate: requestDelete, isPending: isRequestingDelete } = useRequestDelete();
  const { mutate: confirmDelete } = useConfirmDelete();
  const setStarterMutation = useSetStarter(teamId, (message) => notify(message));

  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // S03 §7: matriz sugerida (capitán) — set local + guardado explícito.
  const { data: suggestedSlots } = useSuggestedSlots(teamId);
  const setSuggestedMutation = useSetSuggestedSlots(teamId, (message) => notify(message));
  const [suggestSet, setSuggestSet] = useState<Set<string> | null>(null);
  useEffect(() => {
    if (suggestedSlots && suggestSet === null) {
      setSuggestSet(new Set(suggestedSlots.map((s) => `${s.dayOfWeek}|${s.timeSlot}`)));
    }
  }, [suggestedSlots, suggestSet]);
  const toggleSuggested = (dayOfWeek: number, timeSlot: number) => {
    setSuggestSet((prev) => {
      const next = new Set(prev ?? []);
      const key = `${dayOfWeek}|${timeSlot}`;
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // S03 §5: transferencia con PlayerGrid (receptor) + entrantes pendientes.
  const [openPlayerId, setOpenPlayerId] = useState<string | null>(null);
  const requestTransferMutation = useRequestTransfer((message) => notify(message));
  const { data: pendingTransfers } = usePendingTransfers();
  const acceptTransferMutation = useAcceptTransfer(teamId, (message) => notify(message));
  const rejectTransferMutation = useRejectTransfer((message) => notify(message));

  useEffect(() => {
    if (leaveError) notify(leaveError.message);
  }, [leaveError]);

  if (!isLoggedIn) {
    return (
      <div className="pt-14 pb-28">
        <div className="px-4 pt-16">
          <EmptyState
            icon={<LogIn className="size-8" />}
            title="Inicia sesión"
            description="Accede para ver este equipo."
            action={
              <Link
                href="/login"
                className="rounded-lg bg-cypher-2 px-4 py-2 text-xs font-bold text-cypher-5 active:bg-cypher-2-1"
              >
                Iniciar sesión
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  if (isLoading) return <LoadingSkeleton variant="card" rows={4} className="pt-14" />;

  if (isError || !team) {
    return (
      <div className="pt-14 pb-28">
        <div className="px-4 pt-16">
          <EmptyState
            icon={isError ? <ShieldOff className="size-8" /> : <SearchX className="size-8" />}
            title={isError ? "No pudimos cargar el equipo" : "Equipo no encontrado"}
            description={isError ? "Intenta de nuevo en unos segundos." : undefined}
            action={
              isError ? (
                <button
                  type="button"
                  onClick={() => void refetch()}
                  className="rounded-lg bg-cypher-2 px-4 py-2 text-xs font-bold text-cypher-5 active:bg-cypher-2-1"
                >
                  Reintentar
                </button>
              ) : undefined
            }
          />
        </div>
      </div>
    );
  }

  const currentUserId = session?.user?.id;
  // Narrowing a consts locales (lección W4)
  const memberships = team.memberships;
  const myMembership = memberships.find((m) => m.player.profile?.userId === currentUserId) ?? null;
  const isMember = myMembership !== null;
  const isCaptain = myMembership?.isCaptain ?? false;
  const othersCount = memberships.filter((m) => m.player.profile?.userId !== currentUserId).length;
  const memberCount = team._count.memberships;
  const statusLabel = TEAM_STATUS_LABEL[team.status];

  const canManageStarters = isCaptain && team.status !== "INACTIVE";
  const starters = memberships.filter((m) => m.isStarter);
  const bench = memberships.filter((m) => !m.isStarter);
  const startersFull = starters.length >= MAX_STARTERS;

  const toTile = (m: (typeof memberships)[number]) => ({
    name: m.player.profile?.displayName ?? "Jugador",
    image: m.player.profile?.user?.image ?? null,
    isCaptain: m.isCaptain,
  });

  const toggle = (membershipId: string, next: boolean) =>
    setStarterMutation.mutate({ teamId: team.id, membershipId, isStarter: next });

  // Gate espejo del engine: capitán con otros miembros → leave SIEMPRE FORBIDDEN
  const captainLeaveBlocked = isCaptain && othersCount > 0;

  const deletionRequest = team.deletionRequest ?? null;
  const myPlayerId = myMembership?.playerId ?? null;
  const hasVoted = deletionRequest?.votes.some((v) => v.playerId === myPlayerId) ?? false;
  const approveVotes = deletionRequest?.votes.filter((v) => v.approve).length ?? 0;

  return (
    <div className="pt-14 pb-28">
      <HeaderTitle title={team.name} />

      {/* BANNER DE VOTACIÓN */}
      {deletionRequest && isMember && (
        <div className="pt-4">
          <DeletionBanner
            votes={approveVotes}
            totalMembers={memberCount}
            hasVoted={hasVoted}
            onApprove={() => confirmDelete({ requestId: deletionRequest.id, approved: true })}
            onReject={() => confirmDelete({ requestId: deletionRequest.id, approved: false })}
          />
        </div>
      )}

      {/* Card maestra */}
      <div className="mx-4 mt-4 overflow-hidden rounded-2xl border border-cypher-5-1-1 bg-cypher-5-1">
        <svg className="block h-2 w-full" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">
          <rect width="100" height="10" fill={team.primaryColor} />
          {team.secondaryColor && <rect x="75" width="25" height="10" fill={team.secondaryColor} />}
        </svg>
        <div className="flex flex-col items-center p-6 text-center">
          <svg className="size-20" viewBox="0 0 80 80" aria-hidden="true">
            <rect width="80" height="80" rx="16" fill={team.primaryColor} />
            <text x="40" y="50" textAnchor="middle" className="fill-cypher-5 text-2xl font-black">
              {team.abbreviation}
            </text>
          </svg>
          <h1 className="mt-3 text-xl font-bold text-cypher-4">{team.name}</h1>
          <div className="mt-2">
            <Badge variant={statusLabel.variant} status={statusLabel.label} />
          </div>
          {team.status === "DRAFT" && (
            <p className="mt-2 text-[11px] text-cypher-4-2-2">
              El equipo se activa cuando alguien acepta tu invitación.
            </p>
          )}
          <p className="mt-3 text-xs font-medium text-cypher-4-2">
            {memberCount} jugador{memberCount === 1 ? "" : "es"}
          </p>
        </div>
      </div>

      {/* Reclutamiento */}
      {isCaptain && team.status !== "INACTIVE" && (
        <div className="px-4 pt-4">
          <Link
            href={`/reclutamiento/${team.id}`}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-cypher-5-1-1 bg-cypher-5-1 py-3.5 text-sm font-bold text-cypher-4 transition-colors active:bg-cypher-5-1-1"
          >
            <UserPlus className="size-4" />
            Ir a reclutamiento
          </Link>
        </div>
      )}

      {/* HORARIO SUGERIDO (capitán): amarillo en la matriz de tu equipo */}
      {isCaptain && team.status !== "INACTIVE" && (
        <div className="px-4 pt-6">
          <h2 className="mb-1 text-xs font-bold uppercase tracking-widest text-cypher-4-2-2">
            Horario sugerido
          </h2>
          <p className="mb-3 text-[11px] text-cypher-4-2-2">
            Marca las franjas que propones. Aparecen en amarillo en la matriz de tu equipo.
          </p>
          <div className="rounded-2xl border border-cypher-5-1-1 bg-cypher-5-1 p-3">
            <AvailabilityMatrix
              slots={(() => {
                const cells: { dayOfWeek: number; timeSlot: number; status: "SUGGESTED" | "UNAVAILABLE" }[] = [];
                for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
                  for (let timeSlot = 0; timeSlot < 12; timeSlot++) {
                    cells.push({
                      dayOfWeek,
                      timeSlot,
                      status: suggestSet?.has(`${dayOfWeek}|${timeSlot}`) ? "SUGGESTED" : "UNAVAILABLE",
                    });
                  }
                }
                return cells;
              })()}
              onToggleSlot={toggleSuggested}
            />
          </div>
          <button
            type="button"
            disabled={suggestSet === null || setSuggestedMutation.isPending}
            onClick={() => {
              const slots = [...(suggestSet ?? [])].map((key) => {
                const [d, s] = key.split("|").map(Number);
                return { dayOfWeek: d ?? 0, timeSlot: s ?? 0 };
              });
              setSuggestedMutation.mutate({ teamId: team.id, slots });
            }}
            className="mt-3 w-full rounded-xl bg-cypher-2 py-3 text-sm font-bold text-cypher-5 transition-colors active:bg-cypher-2-1 disabled:opacity-50"
          >
            {setSuggestedMutation.isPending ? "Guardando…" : "Guardar sugerencia"}
          </button>
        </div>
      )}

      {/* CAPITANÍA: transferir con PlayerGrid + entrantes pendientes */}
      {isCaptain && team.status !== "INACTIVE" && (
        <div className="px-4 pt-6">
          <h2 className="mb-1 text-xs font-bold uppercase tracking-widest text-cypher-4-2-2">
            Transferir capitanía
          </h2>
          <p className="mb-3 text-[11px] text-cypher-4-2-2">
            El receptor debe aceptar. No puedes quedar sin sucesor.
          </p>
          <PlayerGrid
            players={memberships
              .filter((m) => !m.isCaptain)
              .map((m) => ({
                playerId: m.player.id,
                name: m.player.profile?.displayName ?? "Jugador",
                image: m.player.profile?.user?.image ?? null,
              }))}
            openPlayerId={openPlayerId}
            onTogglePlayer={(playerId) => setOpenPlayerId((prev) => (prev === playerId ? null : playerId))}
            renderPanel={(player) => (
              <div className="flex items-center justify-between gap-2 rounded-xl bg-cypher-5-1-1 px-3 py-2">
                <span className="truncate text-xs text-cypher-4-2">
                  Transferir a {player.name}
                </span>
                <button
                  type="button"
                  disabled={requestTransferMutation.isPending}
                  onClick={() =>
                    requestTransferMutation.mutate(
                      { teamId: team.id, toPlayerId: player.playerId },
                      { onSuccess: () => setOpenPlayerId(null) },
                    )
                  }
                  className="rounded-lg bg-cypher-2 px-3 py-1.5 text-xs font-bold text-cypher-5 disabled:opacity-50"
                >
                  Confirmar
                </button>
              </div>
            )}
          />
        </div>
      )}
      {(pendingTransfers ?? [])
        .filter((t) => t.teamId === team.id)
        .map((t) => (
          <div key={t.id} className="px-4 pt-6">
            <div className="rounded-2xl border border-cypher-2/30 bg-cypher-5-1 p-4">
              <p className="text-sm text-cypher-4">
                Te transfieren la capitanía de {t.from.team.name}
              </p>
              <p className="mt-0.5 text-xs text-cypher-4-2-2">
                De {t.from.player.profile?.displayName ?? "el capitán actual"}
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={acceptTransferMutation.isPending}
                  onClick={() => acceptTransferMutation.mutate({ transferId: t.id })}
                  className="flex-1 rounded-xl bg-cypher-2 py-2.5 text-sm font-bold text-cypher-5 disabled:opacity-50"
                >
                  Aceptar
                </button>
                <button
                  type="button"
                  disabled={rejectTransferMutation.isPending}
                  onClick={() => rejectTransferMutation.mutate({ transferId: t.id })}
                  className="flex-1 rounded-xl bg-cypher-5-1-1 py-2.5 text-sm font-bold text-cypher-4-2 disabled:opacity-50"
                >
                  Rechazar
                </button>
              </div>
            </div>
          </div>
        ))}

      {/* PREVISUALIZACIÓN TÁCTICA */}
      <div className="px-4 pt-6">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-cypher-4-2-2">
          Previsualización táctica
        </h2>
        <TacticalView
          starters={starters.map((m) => ({
            playerId: m.player.id,
            displayName: m.player.profile?.displayName ?? null,
            image: m.player.profile?.user?.image ?? null,
          }))}
        />
      </div>

      {/* CANCHA */}
      <div className="px-4 pt-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-widest text-cypher-4-2-2">En cancha</h2>
          <span
            className={
              startersFull
                ? "rounded-full bg-cypher-3 px-3 py-1 text-xs font-bold text-cypher-5"
                : "rounded-full bg-cypher-5-1-1 px-3 py-1 text-xs font-bold text-cypher-4-2"
            }
          >
            {starters.length}/{MAX_STARTERS}
          </span>
        </div>
        <div className="grid grid-cols-5 gap-3">
          {starters.map((m) => (
            <StarterTile
              key={m.id}
              {...toTile(m)}
              active
              onToggle={() => toggle(m.id, false)}
            />
          ))}
        </div>
      </div>

      {/* BANCO */}
      <div className="px-4 pt-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-widest text-cypher-4-2-2">Banco</h2>
          <span className="rounded-full bg-cypher-5-1-1 px-3 py-1 text-xs font-bold text-cypher-4-2">
            {bench.length}
          </span>
        </div>
        <div className="grid grid-cols-5 gap-3">
          {bench.map((m) => (
            <StarterTile
              key={m.id}
              {...toTile(m)}
              disabled={!canManageStarters || startersFull}
              onToggle={() => toggle(m.id, true)}
            />
          ))}
        </div>
        {canManageStarters && (
          <p className="mt-2 text-[11px] text-cypher-4-2-2">
            {startersFull
              ? "Cancha completa (5/5): quita alguien para dar ingreso."
              : "Doble toque para poner en cancha. Máximo 5."}
          </p>
        )}
      </div>

      {/* Acciones de miembro */}
      {isMember && team.status !== "INACTIVE" && (
        <div className="mt-8 flex flex-col gap-3 px-4">
          {captainLeaveBlocked ? (
            <>
              <button
                type="button"
                disabled
                className="w-full cursor-not-allowed rounded-xl border border-cypher-5-1-1 bg-cypher-5-1 py-3 text-sm font-bold uppercase tracking-wide text-cypher-4-2-2"
              >
                Abandonar equipo
              </button>
              <p className="text-center text-[11px] text-cypher-4-2-2">
                Debes transferir la capitanía o eliminar el equipo antes de abandonarlo.
              </p>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setIsLeaveModalOpen(true)}
              className="w-full rounded-xl border border-red-500/30 bg-transparent py-3 text-sm font-bold uppercase tracking-wide text-red-400 transition-colors active:scale-[0.98] active:bg-red-500/10"
            >
              Abandonar equipo
            </button>
          )}

          {isCaptain && !deletionRequest && (
            <button
              type="button"
              onClick={() => setIsDeleteModalOpen(true)}
              disabled={isRequestingDelete}
              className="w-full rounded-xl border border-cypher-5-1-1 bg-transparent py-3 text-sm font-bold uppercase tracking-wide text-cypher-4-2 transition-colors active:scale-[0.98] active:bg-cypher-5-1-1 disabled:opacity-50"
            >
              Eliminar equipo
            </button>
          )}
        </div>
      )}

      {/* MODALES — textos = validaciones reales del engine */}
      <ConfirmModal
        isOpen={isLeaveModalOpen}
        title="Abandonar equipo"
        message={
          isCaptain
            ? "Eres el único miembro: al abandonar, el equipo pasará a estado INACTIVO. ¿Seguro?"
            : "¿Seguro que quieres abandonar este equipo? Tendrás que ser invitado de nuevo para volver."
        }
        confirmText={isLeaving ? "Abandonando..." : "Sí, abandonar"}
        variant="danger"
        onConfirm={() => leaveTeam({ teamId })}
        onCancel={() => setIsLeaveModalOpen(false)}
      />

      <ConfirmModal
        isOpen={isDeleteModalOpen}
        title="Eliminar equipo"
        message={
          memberCount < 3
            ? "Con menos de 3 miembros el equipo pasa a INACTIVO inmediatamente. ¿Seguro?"
            : "Con 3 o más miembros se inicia una votación: todos deben aprobar para eliminarlo. ¿Iniciar la votación?"
        }
        confirmText={isRequestingDelete ? "Procesando..." : "Sí, continuar"}
        variant="danger"
        onConfirm={() => {
          requestDelete({ teamId });
          setIsDeleteModalOpen(false);
        }}
        onCancel={() => setIsDeleteModalOpen(false)}
      />

      <Toast toast={toast} />
    </div>
  );
}