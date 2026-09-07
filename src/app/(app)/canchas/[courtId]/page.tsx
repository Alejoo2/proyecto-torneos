import { CourtDetailTemplate } from "torneos/components/features/court/court-detail-template";
import { auth } from "torneos/server/auth";
import { db } from "torneos/server/db";

export default async function CourtDetailPage({
  params,
}: {
  params: Promise<{ courtId: string }>;
}) {
  const { courtId } = await params;
  const session = await auth();

  // Verificar si el usuario es admin
  let isAdmin = false;
  if (session?.user?.id) {
    const adminRole = await db.roleAssignment.findFirst({
      where: {
        profile: { userId: session.user.id },
        role: { name: "admin" } // O validarlo por permiso court:edit si lo prefieres
      },
    });
    isAdmin = !!adminRole;
  }

  return <CourtDetailTemplate courtId={courtId} isAdmin={isAdmin} />;
}