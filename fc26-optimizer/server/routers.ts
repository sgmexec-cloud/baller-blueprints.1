import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { scoutRouter } from "./routers/scout";
import { stripeRouter } from "./routers/stripe";
import { getDb } from "./db"; 
import { users } from "../drizzle/schema"; 
import { eq } from "drizzle-orm";
import fs from 'fs/promises';
import path from 'path';
import { z } from "zod"; // 👉 Added zod for input validation

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    getMe: publicProcedure.query(async ({ ctx }) => {
      if (!ctx.userId) return null;
      
      const db = await getDb(); 
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

  build: router({
    // 👉 UPDATED: Now accepts gameVersion and fetches the correct CSV
    getProgression: publicProcedure
      .input(z.object({
        gameVersion: z.enum(["FC26", "FC27"]).optional().default("FC26")
      }))
      .query(async ({ input }) => {
        const folderName = input.gameVersion === "FC27" ? "data27" : "data";
        const fileName = input.gameVersion === "FC27" ? "FC27_PROGRESSION.csv" : "progression.csv";
        const filePath = path.join(process.cwd(), 'server', folderName, fileName);
        
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const lines = fileContent.trim().split('\n');
        
        const progressionData: Record<number, { apAvailable: number, signatureUpgrades: number, customSlots: number }> = {};
        
        for (let i = 1; i < lines.length; i++) {
          const [level, ap, signatures, custom] = lines[i].split(',');
          progressionData[Number(level)] = {
            apAvailable: Number(ap),
            signatureUpgrades: Number(signatures),
            customSlots: Number(custom)
          };
        }
        
        return progressionData;
      }),
  }),

  scout: scoutRouter,
  stripe: stripeRouter,
});

export type AppRouter = typeof appRouter;
