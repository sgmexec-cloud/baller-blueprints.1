import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { authRouter } from "../auth";

import Stripe from "stripe";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq, sql } from "drizzle-orm"; 

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

function getTierFromPriceId(priceId: string): "premium" | "premium_plus" | "vip" | "free" {
  const cleanPrice = priceId.trim();
  const envPremium = process.env.STRIPE_PRICE_PREMIUM?.trim();
  const envPremiumPlus = process.env.STRIPE_PRICE_PREMIUM_PLUS?.trim();
  const envVip = process.env.STRIPE_PRICE_VIP?.trim();

  if (cleanPrice === envVip) return "vip";
  if (cleanPrice === envPremiumPlus) return "premium_plus";
  if (cleanPrice === envPremium) return "premium";
  
  return "free";
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  
  // 👉 DATABASE FIX: Update ENUMs and Columns automatically on startup
  try {
    const db = await getDb();
    if (db) {
      await db.execute(sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "stripeCustomerId" text;`);
      await db.execute(sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" text;`);
      
      // 👉 THE ENUM FIX: Teach the database the new tier names
      try {
        await db.execute(sql`ALTER TYPE "tier" ADD VALUE IF NOT EXISTS 'premium_plus';`);
        await db.execute(sql`ALTER TYPE "tier" ADD VALUE IF NOT EXISTS 'vip';`);
        console.log("✅ Database ENUMs updated successfully!");
      } catch (enumErr) {
        console.log("Notice: ENUMs might already exist or skipped.");
      }
      
      console.log("Stripe columns verified!");
    }
  } catch (err) {
    console.log("Notice: Columns might already exist or skipped.");
  }
  
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2024-06-20",
  });

  app.post(
    "/api/webhook",
    express.raw({ type: "application/json" }), 
    async (req, res) => {
      const sig = req.headers["stripe-signature"];
      let event;

      try {
        event = stripe.webhooks.constructEvent(
          req.body,
          sig as string,
          process.env.STRIPE_WEBHOOK_SECRET!
        );
      } catch (err: any) {
        console.error(`Webhook Error: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }

      console.log(`🔔 Webhook Event: ${event.type}`);

      try {
        const db = await getDb();
        if (!db) throw new Error("Database not connected");

        if (event.type === "checkout.session.completed") {
          const session = event.data.object as Stripe.Checkout.Session;
          const discordId = session.client_reference_id;
          const customerId = session.customer as string;
          const subscriptionId = session.subscription as string;

          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const priceId = subscription.items.data[0].price.id;
          const newTier = getTierFromPriceId(priceId);

          if (discordId) {
            await db.update(users)
              .set({
                tier: newTier,
                stripeCustomerId: customerId,
                stripeSubscriptionId: subscriptionId,
                monthlyBuilds: 0, 
              })
              .where(eq(users.openId, discordId));
              
            console.log(`✅ UPGRADED user ${discordId} to ${newTier}!`);
          }
        }

        if (event.type === "customer.subscription.updated") {
          const subscription = event.data.object as Stripe.Subscription;
          const customerId = subscription.customer as string;
          const priceId = subscription.items.data[0].price.id;
          const newTier = getTierFromPriceId(priceId);

          await db.update(users)
            .set({
              tier: newTier,
              monthlyBuilds: 0,
            })
            .where(eq(users.stripeCustomerId, customerId));

          console.log(`✅ UPDATED tier to ${newTier} for customer ${customerId}!`);
        }

        if (event.type === "customer.subscription.deleted") {
          const subscription = event.data.object as Stripe.Subscription;
          const customerId = subscription.customer as string;

          await db.update(users)
            .set({
              tier: "free",
              stripeSubscriptionId: null, 
            })
            .where(eq(users.stripeCustomerId, customerId));

          console.log(`🚨 CANCELED: Customer downgraded to free.`);
        }

      } catch (error) {
        console.error("❌ DATABASE ERROR IN WEBHOOK:", error);
      }

      res.json({ received: true });
    }
  );

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  
  app.use("/api/auth", authRouter);
  
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
