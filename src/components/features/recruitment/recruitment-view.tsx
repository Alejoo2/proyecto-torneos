"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Clock, Search, Users } from "lucide-react";
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
    <div className="flex min-h-dvh flex-col bg-cypher-5">
      
      {/* HEADER */}
      <header className="sticky top-0 z-20 border-b border-cypher-5-1-1 bg-cypher-5/80 backdrop-blur-md">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
           <Link
  href="/equipos"
  className="flex h-10 min-h-[44px] w-10 min-w-[44px] items-center justify-center rounded-full transition-colors hover:bg-cypher-4/10 active:bg-cypher-4/15"
  aria-label="Volver al equipo"
>
  <ArrowLeft className="size-6 text-cypher-4-2" />
</Link>
            <div>
              <h2 className="text-sm font-bold text-cypher-4">Reclutamiento</h2>
              <p className="text-xs text-cypher-4-2-2">Los Pibes — {currentTeamMembers}/15</p>
            </div>
          </div>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden pb-24">
        
        {/* SEARCH BAR */}
        <div className="px-6 pb-4 pt-6">
          <div className="flex items-center gap-3 rounded-2xl border border-cypher-5-1-1 bg-cypher-5-1-1 px-4 py-3 transition-all focus-within:border-cypher-4-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cypher-5-1">
              <Search className="size-5 text-cypher-4-2-2" />
            </div>
            <input 
              type="text" 
              placeholder="Buscar jugadores..." 
              className="w-full bg-transparent text-base text-cypher-4 outline-none placeholder:text-cypher-4-2-2"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* FILTROS RÁPIDOS */}
        <div className="px-6 pb-4">
          <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <button 
              type="button"
              aria-pressed={!showFilters}
              className={`inline-flex min-h-[44px] shrink-0 snap-start items-center rounded-full border px-4 text-sm font-medium transition-colors ${!showFilters ? 'border-transparent bg-cypher-2 text-cypher-5' : 'border-cypher-4-2-2/40 text-cypher-4-2 hover:bg-cypher-4/5 active:bg-cypher-4/10'}`}
              onClick={() => setShowFilters(false)}
            >
              Todos
            </button>
            <button 
              type="button"
              aria-pressed={showFilters}
              className={`inline-flex min-h-[44px] shrink-0 snap-start items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors ${showFilters ? 'border-transparent bg-cypher-2 text-cypher-5' : 'border-cypher-4-2-2/40 text-cypher-4-2 hover:bg-cypher-4/5 active:bg-cypher-4/10'}`}
              onClick={() => setShowFilters(true)}
            >
              <Clock className="size-4" />
              Disponibilidad
            </button>
          </div>
        </div>

        {/* PANEL DE DISPONIBILIDAD */}
        {showFilters && (
          <div className="px-6 pb-4">
            <div className="rounded-2xl border border-cypher-5-1-1 bg-cypher-5-1 p-4">
              <div className="mb-3">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-cypher-4-2-2">Día</label>
                <div className="flex flex-wrap gap-1.5">
                  {DAYS.map((day, idx) => (
                    <button 
                      key={day}
                      type="button"
                      aria-pressed={selectedDay === idx}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${selectedDay === idx ? 'bg-cypher-2 text-cypher-5' : 'bg-cypher-5-1-1 text-cypher-4-2 hover:bg-cypher-4/10'}`}
                      onClick={() => setSelectedDay(selectedDay === idx ? undefined : idx)}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-cypher-4-2-2">Franja horaria</label>
                <div className="flex flex-wrap gap-1.5">
                  {SLOTS.map((slot, idx) => (
                    <button 
                      key={slot}
                      type="button"
                      aria-pressed={selectedSlot === idx}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${selectedSlot === idx ? 'bg-cypher-2 text-cypher-5' : 'bg-cypher-5-1-1 text-cypher-4-2 hover:bg-cypher-4/10'}`}
                      onClick={() => setSelectedSlot(selectedSlot === idx ? undefined : idx)}
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
        <div className="space-y-4 px-6">
          {isLoading && <p className="py-8 text-center text-cypher-4-2-2">Cargando jugadores...</p>}
          
          {!isLoading && filteredPlayers.length === 0 && (
            <div className="flex flex-col items-center py-12">
              <div className="mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-cypher-5-1-1">
                <Users className="size-12 text-cypher-4-2-2" />
              </div>
              <h3 className="mb-1 text-base font-bold text-cypher-4">Sin resultados</h3>
              <p className="text-sm text-cypher-4-2-2">Prueba con otros filtros o nombres.</p>
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