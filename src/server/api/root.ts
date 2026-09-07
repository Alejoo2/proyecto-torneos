import { createCallerFactory, createTRPCRouter } from "torneos/server/api/trpc";
import { profileRouter } from "torneos/server/api/routers/profile";
import { availabilityRouter } from "torneos/server/api/routers/availability";
import { teamRouter } from "torneos/server/api/routers/team";
import { captaincyRouter } from "torneos/server/api/routers/capitaincy";
import { recruitmentRouter } from "torneos/server/api/routers/recruitment"; // <-- NUEVO
import { courtRouter } from "torneos/server/api/routers/court"; // <-- NUEVO


export const appRouter = createTRPCRouter({
  profile: profileRouter,
  availability: availabilityRouter,
  team: teamRouter,
  captaincy: captaincyRouter,
  recruitment: recruitmentRouter,
  court: courtRouter, // <-- NUEVO
});

export type AppRouter = typeof appRouter;
export const createCaller = createCallerFactory(appRouter);