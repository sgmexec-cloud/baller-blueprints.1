import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { users } from "../drizzle/schema";
import { and, eq, gt } from "drizzle-orm";
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

// Save the 6-digit code and expiration time to the user.
// For email logins openId === the (normalised) email, and openId is UNIQUE. The email column is not,
// so matching on email could overwrite the code on several rows with the same address.
export async function setOtpCode(email: string, otp: string, expires: Date) {
  const db = await getDb();
  if (!db) return;

  await db.update(users)
    .set({ otpCode: otp, otpExpires: expires })
    .where(eq(users.openId, email));
}

// Verify the code and wipe it in ONE atomic statement.
// Previously this was "select, compare, then update", so two simultaneous requests carrying the same
// correct code could both succeed before either one cleared it. Now only one UPDATE can match.
export async function verifyOtpCode(email: string, code: string) {
  const db = await getDb();
  if (!db) return null;

  const rows = await db.update(users)
    .set({ otpCode: null, otpExpires: null, lastSignedIn: new Date() })
    .where(
      and(
        eq(users.openId, email),
        eq(users.otpCode, code),
        gt(users.otpExpires, new Date()) // not expired
      )
    )
    .returning();

  return rows[0] ?? null;
}
