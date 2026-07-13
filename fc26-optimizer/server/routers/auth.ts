import { router, publicProcedure } from "../trpc";
import { db } from "../db";
import { users } from "../schema";
import { eq } from "drizzle-orm";

export const authRouter = router({
  
  // This is the route the homepage is calling!
  getMe: publicProcedure.query(async ({ ctx }) => {
    
    // 1. If there is no userId in the context, they are not logged in.
    if (!ctx.userId) {
      return null;
    }

    // 2. Search our Postgres database for a user with this Discord ID
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.openId, ctx.userId))
      .limit(1);

    // 3. Send the user data to the frontend!
    return user || null;
  }),
  
});
