"use client";
import { api } from "torneos/trpc/react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLeaveTeam, useRequestDelete, useVoteDeletion, useCancelDeletionRequest } from "torneos/components/features/team/use-team";
import { ConfirmModal } from "torneos/components/ui/confirm-modal/confirm-modal";

interface Props { teamId: string }

export function TeamDetailView({ teamId }: Props) {
  const router = useRouter();
  const { data: session } = useSession();
  const { data: team, isLoading } = api.team.getById.useQuery({ teamId });
  
  // Hooks de mutaciones
  const { mutate: leaveTeam, isPending: isLeaving } = useLeaveTeam();
  const { mutate: requestDelete, isPending: isRequestingDelete } = useRequestDelete();
  const { mutate: voteDeletion, isPending: isVoting } = useVoteDeletion();
  const { mutate: cancelRequest } = useCancelDeletionRequest();
  
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  if (isLoading) return <div className="p-8 text-center text-gray-500">Cargando equipo...</div>;
  if (!team) return <div className="p-8 text-center text-red-500">Equipo no encontrado.</div>;

  const currentUserId = session?.user?.id;
  const isMember = team.memberships.some(m => m.player.profile?.userId === currentUserId);
  const isCaptain = team.memberships.some(m => m.isCaptain && m.player.profile?.userId === currentUserId);
  
  // Lógica de Eliminación / Votación
  const deletionRequest = team.deletionRequest;
  const hasPendingRequest = deletionRequest?.status === "PENDING";
  const hasVoted = deletionRequest?.votes.some(v => v.player.profile?.userId === currentUserId) ?? false;
  const myVote = deletionRequest?.votes.find(v => v.player.profile?.userId === currentUserId);

  const handleDelete = () => {
    requestDelete({ teamId }, {
      onSuccess: (data) => {
        setIsDeleteModalOpen(false);
        if (data.directDelete) {
          router.push("/equipos"); // Si se eliminó directo, salir de la vista
        }
      }
    });
  };

  const handleVote = (approve: boolean) => {
    voteDeletion({ teamId, approve });
  };

  const handleCancelRequest = () => {
    cancelRequest({ teamId });
  };

  return (
    <div className="flex flex-col min-h-[100dvh] bg-gray-50 pb-20">
      
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/equipos" className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors min-w-[44px] min-h-[44px]" aria-label="Volver">
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h2 className="text-base font-bold text-gray-900 truncate">{team.name}</h2>
          <div className="w-10"></div>
        </div>
      </header>

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

      {/* BANNER DE VOTACIÓN DE ELIMINACIÓN */}
      {hasPendingRequest && isMember && (
        <div className="mx-4 mb-4 p-4 bg-red-50 border border-red-200 rounded-2xl flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <svg className="w-6 h-6 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h3 className="text-sm font-bold text-red-900">Votación de Eliminación</h3>
              <p className="text-xs text-red-700 mt-1">
                El capitán ha solicitado eliminar este equipo. Se requiere el voto afirmativo de todos los miembros.
              </p>
            </div>
          </div>
          
          {!hasVoted ? (
            <div className="flex gap-2">
              <button 
                onClick={() => handleVote(true)} 
                disabled={isVoting}
                className="flex-1 bg-red-500 text-white py-2 rounded-xl text-xs font-bold uppercase hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                Votar Eliminar
              </button>
              <button 
                onClick={() => handleVote(false)} 
                disabled={isVoting}
                className="flex-1 bg-white text-gray-700 border border-gray-200 py-2 rounded-xl text-xs font-bold uppercase hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Rechazar
              </button>
            </div>
          ) : (
            <div className="text-center text-xs font-bold text-red-800 bg-white py-2 rounded-xl border border-red-100">
              {myVote?.approve ? "Has votado eliminar. Esperando al resto..." : "Tu voto rechazó la eliminación."}
            </div>
          )}

          {/* Botón para que el capitán cancele la solicitud */}
          {isCaptain && (
            <button 
              onClick={handleCancelRequest}
              className="text-xs text-gray-500 hover:text-gray-700 underline mt-1"
            >
              Cancelar solicitud de eliminación
            </button>
          )}
        </div>
      )}

      {/* Botón de Reclutamiento (Solo Capitán) */}
      {isCaptain && !hasPendingRequest && (
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
              <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center shrink-0 overflow-hidden">
                {m.player.profile?.user?.image ? (
                  <img src={m.player.profile.user.image} alt={m.player.profile.displayName ?? "Jugador"} className="w-full h-full object-cover" />
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
      {isMember && !hasPendingRequest && (
        <div className="px-4 mt-8 flex flex-col gap-3">
          {isCaptain ? (
            <button 
              onClick={() => setIsDeleteModalOpen(true)}
              className="w-full bg-white text-red-500 border border-red-200 py-3 rounded-xl font-bold text-sm uppercase tracking-wide hover:bg-red-50 transition-colors active:scale-[0.98]"
            >
              Eliminar Equipo
            </button>
          ) : (
            <button 
              onClick={() => setIsLeaveModalOpen(true)}
              className="w-full bg-white text-red-500 border border-red-200 py-3 rounded-xl font-bold text-sm uppercase tracking-wide hover:bg-red-50 transition-colors active:scale-[0.98]"
            >
              Abandonar Equipo
            </button>
          )}
        </div>
      )}

      {/* Modales */}
      <ConfirmModal
        isOpen={isLeaveModalOpen}
        title="Abandonar Equipo"
        message="¿Estás seguro de que quieres abandonar este equipo? Tendrás que ser invitado de nuevo para volver."
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
            ? "Como la plantilla es menor a 3, el equipo se eliminará inmediatamente. ¿Estás seguro?"
            : "Como la plantilla es de 3 o más, se creará una solicitud de votación. Todos los miembros deberán aprobarla. ¿Deseas iniciar la votación?"
        }
        confirmText={isRequestingDelete ? "Procesando..." : "Sí, Continuar"}
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setIsDeleteModalOpen(false)}
      />
    </div>
  );
}