"use client";

import { useState } from "react";
import { CalendarX2, Trophy, Users } from "lucide-react";
import { TeamCard } from "torneos/components/ui/team-card/team-card";
import { TournamentCard } from "torneos/components/ui/tournament/tournament-card";
import { EmptyState } from "torneos/components/ui/empty-state";
import { LoadingSkeleton } from "torneos/components/ui/loading-skeleton";
import { CreateTeamSheet } from "torneos/components/features/team/create-team-sheet";

const FIXTURE_LIST_TEAMS = [
  { id: "team-1", name: "Storm FC", abbreviation: "STM", primaryColor: "#7B2CBF", secondaryColor: null, status: "ACTIVE" },
  { id: "team-2", name: "Orbit City", abbreviation: "ORB", primaryColor: "#CCFF00", secondaryColor: "#141414", status: "DRAFT" },
  { id: "team-3", name: "Barrio Sur", abbreviation: "BSU", primaryColor: "#EF4444", secondaryColor: null, status: "INACTIVE" },
] as const;

const FIXTURE_LIST_TOURNAMENTS = [
  { id: "tor-1", name: "Copa Barrial", court: { name: "Cancha Sogamoso" }, dayOfWeek: 2, timeSlot: 3, _count: { enrollments: 6 }, maxTeams: 8 },
  { id: "tor-2", name: "Liga Nocturna", court: { name: "Nobsa Arena" }, dayOfWeek: 5, timeSlot: 7, _count: { enrollments: 8 }, maxTeams: 8 },
  { id: "tor-3", name: "Torneo Relámpago", court: { name: "Cancha Sogamoso" }, dayOfWeek: 6, timeSlot: 1, _count: { enrollments: 2 }, maxTeams: 4 },
];

function SceneHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-cypher-4-2-2">{children}</h2>;
}

export function Wave7TeamsScene() {
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div className="px-4 pt-14 pb-28">
      <section className="mb-8">
        <SceneHeading>Cards de equipo (Badge vía status-labels)</SceneHeading>
        <div className="flex flex-col gap-3">
          {FIXTURE_LIST_TEAMS.map((team) => (
            <TeamCard
              key={team.id}
              name={team.name}
              abbreviation={team.abbreviation}
              primaryColor={team.primaryColor}
              secondaryColor={team.secondaryColor}
              status={team.status}
            />
          ))}
        </div>
      </section>
      <section className="mb-8">
        <SceneHeading>Estado vacío</SceneHeading>
        <EmptyState
          icon={<Users className="size-8" />}
          title="Aún no perteneces a ningún equipo"
          description="Crea tu primer equipo o acepta una invitación desde la bandeja."
        />
      </section>
      <section className="mb-8">
        <SceneHeading>Carga</SceneHeading>
        <LoadingSkeleton variant="grid" />
      </section>
      <section>
        <SceneHeading>Sheet de creación (patrón W5)</SceneHeading>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="rounded-lg bg-cypher-2 px-4 py-2 text-xs font-bold text-cypher-5 active:bg-cypher-2-1"
        >
          Abrir &quot;Crear equipo&quot;
        </button>
      </section>
      <CreateTeamSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </div>
  );
}

export function Wave7TournamentsScene() {
  return (
    <div className="px-4 pt-14 pb-28">
      <section className="mb-8">
        <SceneHeading>Cards de torneo (cupos con Age en la página real)</SceneHeading>
        <div className="flex flex-col gap-3">
          {FIXTURE_LIST_TOURNAMENTS.map((t) => (
            <TournamentCard key={t.id} tournament={t} />
          ))}
        </div>
      </section>
      <section className="mb-8">
        <SceneHeading>Estado vacío (sin publicados)</SceneHeading>
        <EmptyState
          icon={<Trophy className="size-8" />}
          title="No hay torneos publicados por ahora"
          description="Cuando una cancha publique uno, aparecerá aquí."
        />
      </section>
      <section className="mb-8">
        <SceneHeading>Estado vacío (filtro sin resultados)</SceneHeading>
        <EmptyState
          icon={<CalendarX2 className="size-8" />}
          title="Sin torneos ese día"
          description="Prueba con otro día de la semana."
        />
      </section>
      <section>
        <SceneHeading>Carga</SceneHeading>
        <LoadingSkeleton variant="grid" />
      </section>
    </div>
  );
}