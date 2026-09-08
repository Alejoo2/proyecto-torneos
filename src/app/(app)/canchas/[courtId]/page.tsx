import { CourtDetailTemplate } from "torneos/components/features/court/court-detail-template";

export default async function CourtDetailPage({ params }: { params: Promise<{ courtId: string }> }) {
  const { courtId } = await params;
  return <CourtDetailTemplate courtId={courtId} />;
}