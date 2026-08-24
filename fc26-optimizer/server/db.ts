import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import type { InferInsertModel } from "drizzle-orm";

let _db: ReturnType<typeof drizzle> | null = null;

// Automatically infers your InsertUser type from your schema
type InsertUser = InferInsertModel<typeof users>;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    _db = drizzle(postgres(process.env.DATABASE_URL));
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.insert(users)
    .values(user)
    .onConflictDoUpdate({
      target: users.openId,
      set: {
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        lastSignedIn: new Date(),
        updatedAt: new Date(),
      }
    });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// 👉 NEW: Save the 6-digit code and expiration time to the user
export async function setOtpCode(email: string, otp: string, expires: Date) {
  const db = await getDb();
  if (!db) return;

  await db.update(users)
    .set({ otpCode: otp, otpExpires: expires })
    .where(eq(users.email, email));
}

// 👉 NEW: Verify the code and wipe it so it can't be reused
export async function verifyOtpCode(email: string, code: string) {
  const db = await getDb();
  if (!db) return null;

  // Find the user by their email
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const user = result[0];

  // If no user, wrong code, or no expiration set, reject!
  if (!user || user.otpCode !== code || !user.otpExpires) {
    return null; 
  }

  // If the current time is past the expiration time, reject!
  if (new Date() > user.otpExpires) {
    return null; 
  }

  // Success! Clear the OTP fields so the code can't be used twice
  await db.update(users)
    .set({ otpCode: null, otpExpires: null })
    .where(eq(users.email, email));

  return user;
}
