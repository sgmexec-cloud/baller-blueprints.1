import { router, protectedProcedure } from "./_core/trpc";
import { getQuota } from "./buildQuota";
import { buildsRouter } from "./build";

export const scoutRouter = router({
  /** Safe me query that returns core user profile details without exposing internal tokens */
  me: protectedProcedure.query(async ({ ctx }) => {
    const user = ctx.user;
    return {
      id: user.id,
      name: user.name ?? user.email,
      email: user.email,
      tier: user.tier ?? "free",
    };
  }),

  /** Get current user's monthly AI build quota info */
  getQuota: protectedProcedure.query(async ({ ctx }) => {
    return await getQuota(ctx.user.id);
  }),

  /** Saved builds & Global Profile sub-router */
  builds: buildsRouter,
});

export type ScoutRouter = typeof scoutRouter;
