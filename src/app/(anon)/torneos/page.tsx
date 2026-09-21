import { api, HydrateClient } from "torneos/trpc/server";
import { TournamentsListTemplate } from "torneos/components/features/tournament/tournaments-list-template";

export default async function TournamentsPage() {
  // Vitrina pública (listPublic): PUBLIC + publicados, cupos = APPROVED.
  // Header propio eliminado → el título vive en AppHeader vía HeaderTitle (N-4).
  await api.tournament.listPublic.prefetch();

  return (
    <HydrateClient>
      <TournamentsListTemplate />
    </HydrateClient>
  );
}