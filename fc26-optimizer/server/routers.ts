import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { scoutRouter } from "./routers/scout";
import { getDb } from "./db"; // Changed to import getDb
import { users } from "../drizzle/schema"; 
import { eq } from "drizzle-orm";

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    getMe: publicProcedure.query(async ({ ctx }) => {
      if (!ctx.userId) return null;
      
      const db = await getDb(); // Now we get the db instance properly
      if (!db) return null;

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.openId, ctx.userId))
        .limit(1);
        
      return user || null;
    }),
    
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      ctx.res.clearCookie("clubdna_auth");
      return { success: true } as const;
    }),
  }),

  scout: scoutRouter,
});

export type AppRouter = typeof appRouter;
