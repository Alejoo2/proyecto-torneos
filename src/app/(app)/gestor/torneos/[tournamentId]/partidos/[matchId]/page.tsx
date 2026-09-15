import { ManagerMatchTemplate } from "torneos/components/features/match/manager-match-template";

export default async function Page({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  return <ManagerMatchTemplate matchId={matchId} />;
}