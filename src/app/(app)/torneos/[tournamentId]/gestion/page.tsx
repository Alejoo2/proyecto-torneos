import { ManagerEnrollmentsTemplate } from "torneos/components/features/tournament/manager-enrollments-template";

export default async function ManagerEnrollmentsPage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params;
  return <ManagerEnrollmentsTemplate tournamentId={tournamentId} />;
}