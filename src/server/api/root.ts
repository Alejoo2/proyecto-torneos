import { postRouter } from "torneos/server/api/routers/post"; // Puedes borrar esto si ya no usas el scaffold de T3
import { profileRouter } from "torneos/server/api/routers/profile";
import { availabilityRouter } from "torneos/server/api/routers/availability";
import { createTRPCRouter } from "torneos/server/api/trpc";

export const appRouter = createTRPCRouter({
  // post: postRouter, // Bórralo si limpiaste el código de ejemplo de T3
  profile: profileRouter,
  availability: availabilityRouter,
});