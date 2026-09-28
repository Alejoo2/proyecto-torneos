"use client";

import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
import { useMyInvitations, useAcceptInvitation, useRejectInvitation, useMyTeamInvites, useAcceptTeamInvite, useDeclineTeamInvite } from "torneos/components/features/recruitment/use-recruitment";
import { InvitationCard } from "torneos/components/ui/invitation-card/invitation-card";

export function InvitationsView() {
  // 1. Hooks de dominio
  const { data: invitations, isLoading } = useMyInvitations();
  const { mutate: accept, isPending: isAccepting } = useAcceptInvitation();
  const { mutate: reject, isPending: isRejecting } = useRejectInvitation();
  const { data: teamInvites, isLoading: isLoadingTeamInvites } = useMyTeamInvites();
  const { mutate: acceptTeam, isPending: isAcceptingTeam } = useAcceptTeamInvite();
  const { mutate: declineTeam, isPending: isDecliningTeam } = useDeclineTeamInvite();

  return (
    <div className="flex min-h-dvh flex-col bg-cypher-5">
      
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-cypher-5-1-1 bg-cypher-5/80 backdrop-blur-md">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex h-10 min-h-[44px] w-10 min-w-[44px] items-center justify-center rounded-full transition-colors hover:bg-cypher-4/10 active:bg-cypher-4/15" aria-label="Volver">
              <ArrowLeft className="size-6 text-cypher-4-2" />
            </Link>
            <h2 className="text-base font-bold text-cypher-4">Mis Invitaciones</h2>
          </div>
        </div>
      </header>

      {/* Contenido */}
      <main className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
        {isLoading && (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-32 animate-pulse rounded-2xl border border-cypher-5-1-1/60 bg-cypher-5-1 p-4" />
            ))}
          </div>
        )}

        {!isLoading && !isLoadingTeamInvites && (!invitations || invitations.length === 0) && (!teamInvites || teamInvites.length === 0) && (
          <div className="flex h-[60vh] flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-cypher-5-1-1">
              <Mail className="size-10 text-cypher-4-2-2" />
            </div>
            <h3 className="mb-1 text-base font-bold text-cypher-4">Bandeja vacía</h3>
            <p className="text-sm text-cypher-4-2-2">Aquí aparecerán las invitaciones de equipos y torneos.</p>
          </div>
        )}

        {!isLoading && invitations && invitations.length > 0 && (
          <>
            <p className="text-xs font-semibold uppercase tracking-wide text-cypher-4-2-2">
              {invitations.length} {invitations.length === 1 ? "Invitación pendiente" : "Invitaciones pendientes"}
            </p>
            
            {invitations.map((inv) => (
              <InvitationCard
                key={inv.id}
                teamName={inv.team?.name ?? "Equipo Desconocido"}
                teamPrimaryColor={inv.team?.primaryColor ?? "#000000"}
                inviterName={inv.inviter.profile?.displayName ?? "Capitán Anónimo"}
                onAccept={() => accept({ invitationId: inv.id })}
                onReject={() => reject({ invitationId: inv.id })}
                isAccepting={isAccepting}
                isRejecting={isRejecting}
              />
            ))}
          </>
        )}

        {!isLoadingTeamInvites && teamInvites && teamInvites.length > 0 && (
          <>
            <p className="text-xs font-semibold uppercase tracking-wide text-cypher-4-2-2">
              Torneos privados ({teamInvites.length})
            </p>

            {teamInvites.map((inv) => (
              <div key={inv.id} className="rounded-2xl border border-cypher-5-1-1/60 bg-cypher-5-1 p-4">
                <p className="text-sm font-bold text-cypher-4">{inv.tournament.name}</p>
                <p className="text-xs text-cypher-4-2-2">
                  Invita a tu equipo {inv.team.name} · {inv.tournament.status}
                </p>
                <div className="mt-3 flex gap-2">
                  <Link
                    href={`/torneos/${inv.tournament.id}`}
                    className="inline-flex min-h-[44px] items-center rounded-xl bg-cypher-5-1-1 px-4 py-2 text-xs font-bold text-cypher-4-2 transition-colors hover:bg-cypher-4/10"
                  >
                    Ver torneo
                  </Link>
                  <button
                    type="button"
                    disabled={isAcceptingTeam}
                    onClick={() => acceptTeam({ inviteId: inv.id })}
                    className="inline-flex min-h-[44px] items-center rounded-xl bg-cypher-2 px-4 py-2 text-xs font-bold text-cypher-5 disabled:opacity-50"
                  >
                    Aceptar
                  </button>
                  <button
                    type="button"
                    disabled={isDecliningTeam}
                    onClick={() => declineTeam({ inviteId: inv.id })}
                    className="inline-flex min-h-[44px] items-center rounded-xl bg-cypher-5-1-1 px-4 py-2 text-xs font-bold text-cypher-4-2 transition-colors hover:bg-cypher-4/10 disabled:opacity-50"
                  >
                    Rechazar
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </main>
    </div>
  );
}