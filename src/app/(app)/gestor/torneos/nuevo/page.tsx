import { CreateTournamentWizard } from "torneos/components/features/tournament/create-tournament-wizard";

// W11 — E5: ?courtId= preselecciona la cancha (llega del CTA del detalle de cancha).
export default async function NewTournamentPage({
  searchParams,
}: {
  searchParams: Promise<{ courtId?: string }>;
}) {
  const { courtId } = await searchParams;
  return <CreateTournamentWizard initialCourtId={courtId ?? null} />;
}