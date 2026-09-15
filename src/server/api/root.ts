import { createCallerFactory, createTRPCRouter } from "torneos/server/api/trpc";
import { profileRouter } from "torneos/server/api/routers/profile";
import { availabilityRouter } from "torneos/server/api/routers/availability";
import { teamRouter } from "torneos/server/api/routers/team";
import { captaincyRouter } from "torneos/server/api/routers/capitaincy";
import { recruitmentRouter } from "torneos/server/api/routers/recruitment"; // <-- NUEVO
import { courtRouter } from "torneos/server/api/routers/court"; // <-- NUEVO
import { tournamentRouter } from "./routers/tournament";
import { enrollmentRouter } from "./routers/enrollment";
import { adminRouter } from "./routers/admin";
import { matchRouter } from "./routers/match";
import { resultRouter } from "./routers/result";
import { statsRouter } from "./routers/stats";
import { notificationRouter } from "./routers/notification";


export const appRouter = createTRPCRouter({
  profile: profileRouter,
  availability: availabilityRouter,
  team: teamRouter,
  captaincy: captaincyRouter,
  recruitment: recruitmentRouter,
  court: courtRouter,
  tournament: tournamentRouter,
  enrollment: enrollmentRouter,
  admin : adminRouter,
  match: matchRouter,
  result: resultRouter,
  stats: statsRouter,
  notification: notificationRouter, // <-- NUEVO
});

export type AppRouter = typeof appRouter;
export const createCaller = createCallerFactory(appRouter);