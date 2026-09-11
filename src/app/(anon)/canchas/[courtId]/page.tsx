import { notFound } from "next/navigation";
import { auth } from "torneos/server/auth";
import { CourtDetailTemplate } from "torneos/components/features/court/court-detail-template";
import { HydrateClient, api } from "torneos/trpc/server";

export default async function CourtDetailPage({
  params,
}: {
  params: Promise<{ courtId: string }>;
}) {
  const { courtId } = await params;
  const session = await auth();

  // DISABLED/inexistente → 404 de Next (nunca 401)
  try {
    await api.court.getBubble.fetch({ courtId });
  } catch {
    notFound();
  }
  void api.court.getBubble.prefetch({ courtId });

  // Prefetch de lista según sesión (cada template-query consume su semilla)
  if (session) {
    void api.tournament.listByCourt.prefetch({ courtId });
  } else {
    void api.tournament.listByCourtPublic.prefetch({ courtId });
  }

  return (
    <HydrateClient>
      <CourtDetailTemplate courtId={courtId} isLoggedIn={!!session?.user} />
    </HydrateClient>
  );
}