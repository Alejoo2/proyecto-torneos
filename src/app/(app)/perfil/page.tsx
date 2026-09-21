import { redirect } from "next/navigation";
import { auth } from "torneos/server/auth";
import { api, HydrateClient } from "torneos/trpc/server";
import { ProfileView } from "torneos/components/features/profile/profile-view";

export default async function PerfilPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Patrón A: sembrar las 4 lecturas (protegidas — sesión garantizada arriba)
  await api.availability.getMine.prefetch();
  await api.stats.getMyStats.prefetch();
  await api.stats.getMyMatchHistory.prefetch();
  await api.team.getMyTeams.prefetch();

  return (
    <HydrateClient>
      <ProfileView />
    </HydrateClient>
  );
}