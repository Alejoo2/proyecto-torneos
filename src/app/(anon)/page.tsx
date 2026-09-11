import { auth } from "torneos/server/auth";
import { HubTemplate } from "torneos/components/features/hub/hub-template";
import { HydrateClient, api } from "torneos/trpc/server";

export default async function HubPage() {
  const session = await auth();

  // Precarga los pines: getMap es publicProcedure, prefetch legal en anónimo
  void api.court.getMap.prefetch();

  return (
    <HydrateClient>
      <HubTemplate isLoggedIn={!!session?.user} />
    </HydrateClient>
  );
}