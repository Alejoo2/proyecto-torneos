import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "torneos/server/api/trpc";

export const postRouter = createTRPCRouter({
  hello: publicProcedure
    .input(z.object({ text: z.string() }))
    .query(({ input }) => {
      return {
        greeting: `Hello ${input.text}`,
      };
    }),

  // Neutralizamos esta query para que no busque la tabla Post que ya no existe
  getLatest: publicProcedure.query(({ ctx: _ctx }) => {
    return null;
  }),

  create: protectedProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ ctx: _ctx, input: _input }) => {
      return null;
    }),
});