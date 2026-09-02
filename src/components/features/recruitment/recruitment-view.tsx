"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useSearchPlayers, useInvitePlayer, usePlayerProfile } from "torneos/components/features/recruitment/use-recruitment";
import { PlayerCard } from "torneos/components/ui/player-card/player-card";
import { InviteModal } from "torneos/components/ui/invite-modal/invite-modal";
import { PlayerProfileModal } from "torneos/components/ui/player-profile-modal/player-profile-modal";

const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const SLOTS = ["00-02", "02-04", "04-06", "06-08", "08-10", "10-12", "12-14", "14-16", "16-18", "18-20", "20-22", "22-00"];

interface RecruitmentViewProps {
  teamId: string;
}

export function RecruitmentView({ teamId }: RecruitmentViewProps) {
  // 1. Estados locales para Search, Filtros y Modales
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDay, setSelectedDay] = useState<number | undefined>(undefined);
  const [selectedSlot, setSelectedSlot] = useState<number | undefined>(undefined);
  const [showFilters, setShowFilters] = useState(false);
  
  const [selectedPlayer, setSelectedPlayer] = useState<{
    id: string;
    name: string;
    imageUrl: string | null;
    availabilitySummary: string;
    teamCount: number;
  } | null>(null);

  // NUEVO: Estado para el modal de perfil
  const [viewingPlayerId, setViewingPlayerId] = useState<string | null>(null);

  // 2. Hooks de Dominio (tRPC)
  const { data: players, isLoading } = useSearchPlayers(teamId);
  const { mutate: invitePlayer } = useInvitePlayer();
  
  // NUEVO: Query del perfil del jugador seleccionado (solo se ejecuta si hay ID)
  const { data: profileData } = usePlayerProfile(teamId, viewingPlayerId);

  // 3. Helper para resumir la disponibilidad
  const getAvailabilitySummary = (availabilities: { dayOfWeek: number }[]) => {
    if (availabilities.length === 0) return "Sin disponibilidad";
    const days = [...new Set(availabilities.map(a => DAYS[a.dayOfWeek]))];
    if (days.length === 7) return "Todos los días";
    return days.join(", ");
  };

  // 4. Filtrado en cliente para búsqueda rápida
  const filteredPlayers = useMemo(() => {
    if (!players) return [];
    return players.filter(p => 
      p.profile?.displayName?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [players, searchQuery]);

  const handleConfirmInvite = () => {
    if (!selectedPlayer) return;
    setSelectedPlayer(null);
    invitePlayer({ teamId, playerId: selectedPlayer.id });
  };

  const currentTeamMembers = 8; 
  const isTeamFull = currentTeamMembers >= 15;

  return (
    <div className="flex flex-col h-100dvh bg-white">
      
      {/* HEADER */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
           <Link
  href="/equipos"
  className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors min-w-44px min-h-44px"
  aria-label="Volver al equipo"
>
  <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
  </svg>
</Link>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Reclutamiento</h2>
              <p className="text-xs text-gray-500">Los Pibes — {currentTeamMembers}/15</p>
            </div>
          </div>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden pb-24">
        
        {/* SEARCH BAR */}
        <div className="px-6 pt-6 pb-4">
          <div className="bg-gray-100 rounded-2xl flex items-center gap-3 px-4 py-3 focus-within:bg-gray-50 focus-within:ring-2 focus-within:ring-gray-300 transition-all">
            <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input 
              type="text" 
              placeholder="Buscar jugadores..." 
              className="w-full bg-transparent outline-none text-gray-800 placeholder-gray-400 text-base"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* FILTROS RÁPIDOS */}
        <div className="px-6 pb-4">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory">
            <button 
              className={`px-4 py-2 rounded-full text-sm font-medium shrink-0 transition-colors min-h-44px snap-start ${!showFilters ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'}`}
              onClick={() => setShowFilters(false)}
            >
              Todos
            </button>
            <button 
              className={`px-4 py-2 rounded-full text-sm font-medium shrink-0 transition-colors min-h-44px snap-start flex items-center gap-1.5 ${showFilters ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'}`}
              onClick={() => setShowFilters(true)}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Disponibilidad
            </button>
          </div>
        </div>

        {/* PANEL DE DISPONIBILIDAD */}
        {showFilters && (
          <div className="px-6 pb-4">
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
              <div className="mb-3">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">Día</label>
                <div className="flex gap-1.5 flex-wrap">
                  {DAYS.map((day, idx) => (
                    <button 
                      key={day}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${selectedDay === idx ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                      onClick={() => setSelectedDay(selectedDay === idx ? undefined : idx)}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">Franja horaria</label>
                <div className="flex gap-1.5 flex-wrap">
                  {SLOTS.map((slot, idx) => (
                    <button 
                      key={slot}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${selectedSlot === idx ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                      onClick={() => setSelectedSlot(selectedSlot === selectedSlot ? undefined : idx)}
                    >
                      {slot}h
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* RESULTADOS: LISTA DE JUGADORES */}
        <div className="px-6 space-y-4">
          {isLoading && <p className="text-center text-gray-500 py-8">Cargando jugadores...</p>}
          
          {!isLoading && filteredPlayers.length === 0 && (
            <div className="py-12 flex flex-col items-center">
              <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mb-4">
                <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-gray-900 mb-1">Sin resultados</h3>
              <p className="text-sm text-gray-500">Prueba con otros filtros o nombres.</p>
            </div>
          )}

          {!isLoading && filteredPlayers.map((player) => {
            const summary = getAvailabilitySummary(player.availabilities);
            
            return (
              <PlayerCard
                key={player.id}
                playerId={player.id}
                name={player.profile?.displayName ?? "Jugador Anónimo"}
                imageUrl={player.profile?.user?.image ?? null}
                availabilitySummary={summary}
                teamCount={player._count.teamMemberships}
                maxTeams={15}
                isInvited={false}
                isTeamFull={isTeamFull}
                onInvite={(pId) => {
                  setSelectedPlayer({
                    id: pId,
                    name: player.profile?.displayName ?? "Jugador",
                    imageUrl: player.profile?.user?.image ?? null,
                    availabilitySummary: summary,
                    teamCount: player._count.teamMemberships,
                  });
                }}
                onViewProfile={(pId) => setViewingPlayerId(pId)} // NUEVO
              />
            );
          })}
        </div>
      </main>

      {/* MODAL DE INVITACIÓN */}
      <InviteModal
        isOpen={!!selectedPlayer}
        playerName={selectedPlayer?.name ?? null}
        playerAvatar={selectedPlayer?.imageUrl ?? null}
        availabilitySummary={selectedPlayer?.availabilitySummary ?? null}
        teamCount={selectedPlayer?.teamCount ?? null}
        onClose={() => setSelectedPlayer(null)}
        onConfirm={handleConfirmInvite}
      />

      {/* NUEVO: MODAL DE PERFIL PÚBLICO */}
      <PlayerProfileModal
        isOpen={!!viewingPlayerId}
        onClose={() => setViewingPlayerId(null)}
        playerName={profileData?.profile?.displayName ?? null}
        playerAvatar={profileData?.profile?.user?.image ?? null}
        playerBio={profileData?.profile?.bio ?? null}
        slots={profileData?.availabilities ?? []}
      />
    </div>
  );
}