import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { jwtVerify } from "jose";
import * as cookie from "cookie";
import { eq, type InferSelectModel } from "drizzle-orm";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { getJwtSecret } from "./jwtSecret";
import { PREVIEW_COOKIE, resolveEffectiveTier } from "../tierPreview";

type DbUser = InferSelectModel<typeof users>;

export async function createContext({ req, res }: CreateExpressContextOptions) {
  let userId: string | null = null;
  let user: DbUser | null = null;
  let previewCookie: string | undefined;

  try {
    // 1. Read the login cookie
    const cookies = cookie.parse(req.headers.cookie || "");
    const token = cookies.clubdna_auth;
    previewCookie = cookies[PREVIEW_COOKIE];

    // 2. Verify it and find out who it belongs to
    if (token) {
      const { payload } = await jwtVerify(token, getJwtSecret());
      userId = typeof payload.userId === "string" ? payload.userId : null;
    }

    // 3. Load the account. protectedProcedure and the quota check need ctx.user:
    //    without it every logged-in user was treated as logged out.
    if (userId) {
      const db = await getDb();
      if (db) {
        const rows = await db.select().from(users).where(eq(users.openId, userId)).limit(1);
        user = rows[0] ?? null;
      }
    }
  } catch (error) {
    // Fake/expired token, or JWT_SECRET missing: treat the visitor as logged out
  }

  // From here on ctx.user.tier is the plan the user is treated as having. For everyone except the owner it is
  // simply their real plan. realTier always holds the real one.
  const effectiveUser = user
    ? (() => {
        const effectiveTier = resolveEffectiveTier(String(user.tier), previewCookie);
        return {
          ...user,
          tier: effectiveTier as DbUser["tier"],
          realTier: String(user.tier),
          previewing: effectiveTier !== String(user.tier),
        };
      })()
    : null;

  return { req, res, userId, user: effectiveUser };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
// trpc.ts imports this name
export type TrpcContext = Context;
