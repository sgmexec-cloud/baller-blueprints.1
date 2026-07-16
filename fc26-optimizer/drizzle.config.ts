import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./drizzle/schema.ts", // or wherever your schema is located
  out: "./drizzle",
  dialect: "postgresql", // 👉 THIS IS THE FIX
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
