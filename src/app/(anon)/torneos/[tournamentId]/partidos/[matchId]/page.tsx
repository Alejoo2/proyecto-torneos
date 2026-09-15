import { PublicMatchTemplate } from "torneos/components/features/match/public-match-template";

export default async function Page({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  return <PublicMatchTemplate matchId={matchId} />;
}