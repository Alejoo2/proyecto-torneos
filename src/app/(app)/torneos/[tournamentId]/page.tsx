import { TournamentDetailTemplate } from "torneos/components/features/tournament/tournament-detail-template";

export default async function TournamentDetailPage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params;
  return <TournamentDetailTemplate tournamentId={tournamentId} />;
}