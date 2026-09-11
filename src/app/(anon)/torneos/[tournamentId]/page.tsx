import { notFound } from "next/navigation";
import { auth } from "torneos/server/auth";
import { TournamentDetailTemplate } from "torneos/components/features/tournament/tournament-detail-template";
import { HydrateClient, api } from "torneos/trpc/server";

export default async function TournamentDetailPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = await params;
  const session = await auth();

  // Vitrina: PUBLIC + status publicado. DRAFT/PRIVATE/FINISHED/CANCELLED →
  // 404 de Next para cualquiera, sin delatar existencia (§2).
  try {
    await api.tournament.getPublicById.fetch({ tournamentId });
  } catch {
    notFound();
  }
  void api.tournament.getPublicById.prefetch({ tournamentId });

  // Frontera RSC (§3.4): estas lecturas protected SOLO corren con sesión.
  // El anónimo nunca ejecuta este branch.
  if (session) {
    void api.tournament.checkHold.prefetch({ tournamentId });
    void api.team.getMyTeams.prefetch();
  }

  return (
    <HydrateClient>
      <TournamentDetailTemplate tournamentId={tournamentId} isLoggedIn={!!session?.user} />
    </HydrateClient>
  );
}