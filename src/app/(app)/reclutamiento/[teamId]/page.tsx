// src/app/(app)/reclutamiento/[teamId]/page.tsx
import { RecruitmentView } from "torneos/components/features/recruitment/recruitment-view";

interface PageProps {
  params: Promise<{ teamId: string }>;
}

export default async function ReclutamientoPage({ params }: PageProps) {
  const { teamId } = await params;
  return <RecruitmentView teamId={teamId} />;
}