"use client";
import Link from "next/link";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { useGetTeamById, useLeaveTeam, useRequestDelete, useConfirmDelete } from "torneos/components/features/team/use-team";
import { ConfirmModal } from "torneos/components/ui/confirm-modal/confirm-modal";
import { DeletionBanner } from "torneos/components/ui/deletion-banner/deletion-banner";

interface Props { 
  teamId: string; 
}

export function TeamDetailView({ teamId }: Props) {
  const { data: session } = useSession();
  // NUEVO HOOK APLICADO
  const { data: team, isLoading } = useGetTeamById(teamId);
  
  // Mutaciones
  const { mutate: leaveTeam, isPending: isLeaving, error: leaveError } = useLeaveTeam();
  const { mutate: requestDelete, isPending: isRequestingDelete } = useRequestDelete();
  const { mutate: confirmDelete } = useConfirmDelete();
  
  // Modales
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  if (isLoading) return <div className="p-8 text-center text-gray-500">Cargando equipo...</div>;
  if (!team) return <div className="p-8 text-center text-red-500">Equipo no encontrado.</div>;

  const currentUserId = session?.user?.id;
  const isMember = team.memberships.some(m => m.player.profile?.userId === currentUserId);
  const isCaptain = team.memberships.some(m => m.isCaptain && m.player.profile?.userId === currentUserId);
  const myPlayerId = team.memberships.find(m => m.player.profile?.userId === currentUserId)?.playerId;

  // Lógica de Votación 
  const deletionRequest = team.deletionRequest; 
  // Corrección de propiedades según Prisma: voterId y approved
  const hasVoted = deletionRequest?.votes.some(v => v.playerId === myPlayerId) ?? false;
  const approveVotes = deletionRequest?.votes.filter(v => v.approve).length ?? 0;

  return (
    <div className="flex flex-col min-h-dvh bg-gray-50 pb-20">
      
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/equipos" className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors min-w-11 min-h-11" aria-label="Volver">
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h2 className="text-base font-bold text-gray-900 truncate">{team.name}</h2>
          <div className="w-10"></div>
        </div>
      </header>

      {/* BANNER DE VOTACIÓN */}
      {deletionRequest && isMember && (
        <DeletionBanner 
          votes={approveVotes}
          totalMembers={team._count.memberships}
          hasVoted={hasVoted}
          onApprove={() => confirmDelete({ requestId: deletionRequest.id, approved: true })}
          onReject={() => confirmDelete({ requestId: deletionRequest.id, approved: false })}
        />
      )}

      {/* Card Maestra */}
      <div className="bg-white p-6 m-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center text-center">
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-3 overflow-hidden relative">
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 80 80" aria-hidden="true">
            <rect width="80" height="80" fill={team.primaryColor} />
          </svg>
          <span className="relative text-2xl font-black text-white z-10 drop-shadow-md">{team.abbreviation}</span>
        </div>
        <h1 className="text-xl font-bold text-gray-900">{team.name}</h1>
        <p className="text-xs text-gray-500 uppercase font-medium tracking-wide mt-1 mb-4">
          {team.status === "DRAFT" ? "Borrador (Faltan jugadores)" : team.status === "INACTIVE" ? "Equipo Inactivo" : "Equipo Activo"}
        </p>
        
        <div className="flex items-center gap-2 bg-gray-100 px-4 py-2 rounded-full">
          <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3z" />
          </svg>
          <span className="text-sm font-bold text-gray-800">{team._count.memberships}/15 Jugadores</span>
        </div>
      </div>

      {/* Botón de Reclutamiento */}
      {isCaptain && team.status !== "INACTIVE" && (
        <div className="px-4 mb-4">
          <Link 
            href={`/reclutamiento/${team.id}`}
            className="w-full bg-gray-800 text-white py-4 rounded-xl font-bold text-center flex items-center justify-center gap-2 hover:bg-gray-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            Ir a Reclutamiento
          </Link>
        </div>
      )}

      {/* Plantilla */}
      <div className="px-4">
        <h3 className="text-lg font-bold text-gray-900 mb-3">Plantilla ({team._count.memberships})</h3>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100">
          {team.memberships.map((m) => (
            <div key={m.id} className="flex items-center gap-3 p-4">
              <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center shrink-0 overflow-hidden relative">
                {m.player.profile?.user?.image ? (
                  <Image 
                    src={m.player.profile.user.image} 
                    alt={m.player.profile.displayName ?? "Jugador"} 
                    fill 
                    className="object-cover" 
                  />
                ) : (
                  <span className="text-sm font-bold text-gray-500">
                    {m.player.profile?.displayName?.charAt(0).toUpperCase() ?? "?"}
                  </span>
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-gray-900">{m.player.profile?.displayName ?? "Jugador Anónimo"}</p>
                {m.isCaptain && (
                  <span className="text-xs text-emerald-600 font-bold uppercase tracking-wide">Capitán</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Acciones de Miembro */}
      {isMember && team.status !== "INACTIVE" && (
        <div className="px-4 mt-8 flex flex-col gap-3">
          <button 
            onClick={() => setIsLeaveModalOpen(true)}
            className="w-full bg-white text-red-500 border border-red-200 py-3 rounded-xl font-bold text-sm uppercase tracking-wide hover:bg-red-50 transition-colors active:scale-[0.98]"
          >
            Abandonar Equipo
          </button>

          {isCaptain && !deletionRequest && (
            <button 
              onClick={() => setIsDeleteModalOpen(true)}
              disabled={isRequestingDelete}
              className="w-full bg-transparent text-gray-400 border border-gray-200 py-3 rounded-xl font-bold text-sm uppercase tracking-wide hover:bg-gray-100 transition-colors active:scale-[0.98]"
            >
              Eliminar Equipo
            </button>
          )}
        </div>
      )}

      {/* MODALES */}
      <ConfirmModal
        isOpen={isLeaveModalOpen}
        title="Abandonar Equipo"
        message={
          isCaptain 
            ? "Si abandonas el equipo siendo capitán, y no hay otros miembros, el equipo pasará a estado INACTIVO. ¿Estás seguro?"
            : "¿Estás seguro de que quieres abandonar este equipo? Tendrás que ser invitado de nuevo para volver."
        }
        confirmText={isLeaving ? "Abandonando..." : "Sí, Abandonar"}
        variant="danger"
        onConfirm={() => leaveTeam({ teamId })}
        onCancel={() => setIsLeaveModalOpen(false)}
      />

      <ConfirmModal
        isOpen={isDeleteModalOpen}
        title="Eliminar Equipo"
        message={
          team._count.memberships < 3
            ? "Al haber menos de 3 miembros, el equipo se eliminará (pasará a inactivo) inmediatamente. ¿Estás seguro?"
            : "Al tener 3 o más miembros, se iniciará una votación. Todos deben aprobar para que el equipo se elimine. ¿Deseas iniciar la votación?"
        }
        confirmText={isRequestingDelete ? "Procesando..." : "Sí, Continuar"}
        variant="danger"
        onConfirm={() => {
          requestDelete({ teamId });
          setIsDeleteModalOpen(false);
        }}
        onCancel={() => setIsDeleteModalOpen(false)}
      />

      {leaveError && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-red-500 text-white text-xs font-medium px-4 py-2 rounded-full shadow-lg z-50">
          {leaveError.message}
        </div>
      )}
    </div>
  );
}