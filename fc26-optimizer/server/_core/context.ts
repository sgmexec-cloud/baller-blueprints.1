import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { jwtVerify } from "jose";
import * as cookie from "cookie";

// The exact same secret we used to lock the cookie in auth.ts
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "super-secret-clubdna-key-change-me");

export async function createContext({ req, res }: CreateExpressContextOptions) {
  let userId = null;

  try {
    // 1. Grab the cookies from the user's browser
    const cookies = cookie.parse(req.headers.cookie || "");
    const token = cookies.clubdna_auth;

    // 2. If they have a token, unlock it and find out who they are!
    if (token) {
      const { payload } = await jwtVerify(token, JWT_SECRET);
      userId = payload.userId as string; // This is their Discord ID
    }
  } catch (error) {
    // If the token is fake or expired, we just ignore it
  }

  // 3. Pass the userId to the rest of our app
  return {
    req,
    res,
    userId,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
