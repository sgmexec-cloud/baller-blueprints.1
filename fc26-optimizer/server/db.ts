import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import type { InferInsertModel } from "drizzle-orm";

let _db: ReturnType<typeof drizzle> | null = null;

// 👉 NEW: This automatically infers your InsertUser type from your schema
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
        avatar: user.avatar, // 👉 NEW: Ensure avatar is updated on login
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
