import { api, HydrateClient } from "torneos/trpc/server";
import { TeamDetailView } from "torneos/components/features/team/team-detail-view";

interface PageProps {
  params: Promise<{ teamId: string }>;
}

export default async function TeamDetailPage({ params }: PageProps) {
  const { teamId } = await params;
  // Protected: en anónimo el prefetch falla en silencio; el template gatea login.
  await api.team.getById.prefetch({ teamId });

  return (
    <HydrateClient>
      <TeamDetailView teamId={teamId} />
    </HydrateClient>
  );
}