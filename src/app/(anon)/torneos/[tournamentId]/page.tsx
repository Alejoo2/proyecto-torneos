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

  // Vitrina: PUBLIC + publicado. DRAFT/PRIVATE/FINISHED/CANCELLED → 404 sin delatar (§2).
  // Un solo await-materialización: si pasa, la caché ya quedó sembrada.
  try {
    await api.tournament.getPublicById.prefetch({ tournamentId });
  } catch {
    notFound();
  }

  // Frontera RSC: lecturas protected SOLO con sesión (§3.4).
  if (session) {
    void api.tournament.getById.prefetch({ tournamentId });
    void api.tournament.checkHold.prefetch({ tournamentId });
    void api.team.getMyTeams.prefetch();
    void api.enrollment.getMyStatus.prefetch({ tournamentId });
    void api.match.listByTournament.prefetch({ tournamentId });
    void api.stats.getTournamentStandings.prefetch({ tournamentId });
  } else {
    // La vitrina anónima sí ve posiciones (getTournamentStandingsPublic, B-03 vía pública)
    void api.stats.getTournamentStandingsPublic.prefetch({ tournamentId });
  }

  return (
    <HydrateClient>
            <TournamentDetailTemplate
        tournamentId={tournamentId}
        isLoggedIn={!!session?.user}
        sessionUserId={session?.user?.id ?? null}
      />
    </HydrateClient>
  );
}