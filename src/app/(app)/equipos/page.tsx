import { CreateTeamForm } from "torneos/components/features/team/create-team-form";
import { TeamsList } from "torneos/components/features/team/teams-list";

export default function TeamsPage() {
  return (
    <main className="flex flex-col gap-8 p-4 md:p-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Mis Equipos</h1>
        <TeamsList />
      </div>

      <div className="border-t border-gray-100 pt-8">
        <CreateTeamForm />
      </div>
    </main>
  );
}