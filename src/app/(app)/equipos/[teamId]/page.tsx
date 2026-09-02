import { TeamDetailView } from "torneos/components/features/team/team-detail-view";

interface PageProps {
  params: Promise<{ teamId: string }>;
}

export default async function TeamDetailPage({ params }: PageProps) {
  const { teamId } = await params;
  return <TeamDetailView teamId={teamId} />;
}