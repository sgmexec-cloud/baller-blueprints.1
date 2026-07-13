import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { scoutRouter } from "./routers/scout";
import { db } from "./db";
import { users } from "../drizzle/schema"; // Corrected path to root directory
import { eq } from "drizzle-orm";

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  
  auth: router({
    getMe: publicProcedure.query(async ({ ctx }) => {
      // If no userId in context (from our auth.ts), they aren't logged in
      if (!ctx.userId) return null;
      
      // Query the database to get the real user details
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
      ctx.res.clearCookie("clubdna_auth"); // Also clear our new Discord cookie
      return {
        success: true,
      } as const;
    }),
  }),

  scout: scoutRouter,
});

export type AppRouter = typeof appRouter;
