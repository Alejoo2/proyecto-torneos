import { CreateTeamForm } from "torneos/components/features/team/create-team-form";
import { TeamCard } from "torneos/components/ui/team-card/team-card";

export default function TeamsPage() {
  return (
    <main className="flex flex-col gap-8 p-4 md:p-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Mis Equipos</h1>
        
        {/* Ejemplo de cómo se renderiza la Card Maestra con datos estáticos */}
        <div className="w-full max-w-sm">
          <TeamCard 
            name="Los Invencibles"
            abbreviation="INV"
            primaryColor="#1f2937"
            secondaryColor="#fbbf24"
            playerCount={12}
            tournamentCount={3}
            status="ACTIVE"
          />
        </div>
      </div>

      <div className="border-t border-gray-100 pt-8">
        <CreateTeamForm />
      </div>
    </main>
  );
}