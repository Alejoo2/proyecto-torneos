import { HubTemplate } from "torneos/components/features/hub/hub-template";
import { HydrateClient, api } from "torneos/trpc/server";

export default function HubPage() {
  // Precarga los pines en el servidor: el mapa hidrata sin flash de carga
  void api.court.getMap.prefetch();

  return (
    <HydrateClient>
      <HubTemplate />
    </HydrateClient>
  );
}