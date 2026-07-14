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

// 👉 NEW IMPORTS FOR STRIPE WEBHOOK & DB FIX
import Stripe from "stripe";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq, sql } from "drizzle-orm"; // 👉 Added 'sql' here

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

async function startServer() {
  const app = express();
  const server = createServer(app);
  
  // 👉 FREE DATABASE FIX: Add columns manually on startup
  try {
    const db = await getDb();
    if (db) {
      await db.execute(sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "stripeCustomerId" text;`);
      await db.execute(sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" text;`);
      console.log("Stripe columns added to database!");
    }
  } catch (err) {
    console.log("Notice: Columns might already exist or skipped.");
  }
  
  // ── 1. STRIPE WEBHOOK (MUST BE BEFORE express.json) ──
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2024-06-20",
  });

  app.post(
    "/api/webhook",
    express.raw({ type: "application/json" }), // Stripe needs the raw, unedited body
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

      // If the payment was successful...
      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        
        // Grab the Discord ID we sneaked into the checkout link
        const discordId = session.client_reference_id;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        if (discordId) {
          try {
            const db = await getDb();
            if (db) {
              // Give them the VIP Pass!
              await db.update(users)
                .set({
                  tier: "premium",
                  stripeCustomerId: customerId,
                  stripeSubscriptionId: subscriptionId,
                })
                .where(eq(users.openId, discordId));
                
              console.log(`SUCCESS: Upgraded user ${discordId} to Premium!`);
            }
          } catch (error) {
            console.error("Database update failed:", error);
          }
        }
      }

      // Tell Stripe we got the message
      res.json({ received: true });
    }
  );

  // ── 2. STANDARD APP CONFIGURATION ──
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
