"use client";

import Link from "next/link";
import { useMyInvitations, useAcceptInvitation, useRejectInvitation } from "torneos/components/features/recruitment/use-recruitment";
import { InvitationCard } from "torneos/components/ui/invitation-card/invitation-card";

export function InvitationsView() {
  // 1. Hooks de dominio
  const { data: invitations, isLoading } = useMyInvitations();
  const { mutate: accept, isPending: isAccepting } = useAcceptInvitation();
  const { mutate: reject, isPending: isRejecting } = useRejectInvitation();

  return (
    <div className="flex flex-col min-h-dvh bg-gray-50">
      
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors min-w-11 min-h-11" aria-label="Volver">
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h2 className="text-base font-bold text-gray-900">Mis Invitaciones</h2>
          </div>
        </div>
      </header>

      {/* Contenido */}
      <main className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
        {isLoading && (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm h-32 animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && (!invitations || invitations.length === 0) && (
          <div className="flex flex-col items-center justify-center h-[60vh] text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1">Bandeja vacía</h3>
            <p className="text-sm text-gray-500">Aquí aparecerán las invitaciones de los equipos.</p>
          </div>
        )}

        {!isLoading && invitations && invitations.length > 0 && (
          <>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
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
      </main>
    </div>
  );
}