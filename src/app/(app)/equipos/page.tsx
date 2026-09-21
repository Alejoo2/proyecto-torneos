import { api, HydrateClient } from "torneos/trpc/server";
import { TeamListTemplate } from "torneos/components/features/team/team-list-template";

export default async function TeamsPage() {
  // Patrón A/W2: materializar en el RSC y sembrar el caché.
  // Protegida: en anónimo el prefetch falla en silencio y el cache queda vacío;
  // el template gatea con useSession (EmptyState de login).
  await api.team.getMyTeams.prefetch();

  return (
    <HydrateClient>
      <TeamListTemplate />
    </HydrateClient>
  );
}