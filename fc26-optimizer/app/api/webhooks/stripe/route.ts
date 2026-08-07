import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import Stripe from "stripe";

// Helper to map the Price ID to your database Tiers
function getTierFromPriceId(priceId: string): "premium" | "premium_plus" | "vip" | "free" {
  if (priceId === process.env.STRIPE_PRICE_VIP) return "vip";
  if (priceId === process.env.STRIPE_PRICE_PREMIUM_PLUS) return "premium_plus";
  if (priceId === process.env.STRIPE_PRICE_PREMIUM) return "premium";
  return "free";
}

export async function POST(req: Request) {
  const body = await req.text();
  const signature = headers().get("Stripe-Signature") as string;

  let event: Stripe.Event;

  // 1. Verify the webhook signature
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error: any) {
    console.error("❌ Webhook signature verification failed:", error.message);
    return new NextResponse(`Webhook Error: ${error.message}`, { status: 400 });
  }

  // 👉 ADDED: Log the event type so you can see it in Render logs
  console.log(`🔔 Received Stripe Webhook Event: ${event.type}`);

  // 2. Handle the different subscription lifecycle events
  switch (event.type) {
    
    // 👉 TRIGGERED WHEN A USER BUYS A SUB FOR THE FIRST TIME
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const stripeCustomerId = session.customer as string;

      if (!userId) {
        console.error("❌ No userId found in session metadata!");
        break;
      }

      const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
      const priceId = subscription.items.data[0].price.id;
      const newTier = getTierFromPriceId(priceId);

      await db.user.update({
        where: { id: userId },
        data: {
          tier: newTier,
          stripeCustomerId: stripeCustomerId,
          stripeSubscriptionId: subscription.id,
          monthlyBuilds: 0, // 👈 RESETS BUILD COUNTER TO 0 ON FRESH PURCHASE
        },
      });

      console.log(`✅ New subscription for user ${userId} to tier: ${newTier}`);
      break;
    }

    // 👉 TRIGGERED WHEN A USER UPGRADES OR DOWNGRADES TIERS
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const stripeCustomerId = subscription.customer as string;
      const priceId = subscription.items.data[0].price.id;
      const newTier = getTierFromPriceId(priceId);

      // 👉 ADDED: Match by stripeCustomerId OR stripeSubscriptionId so it never misses
      const result = await db.user.updateMany({
        where: {
          OR: [
            { stripeCustomerId: stripeCustomerId },
            { stripeSubscriptionId: subscription.id },
          ],
        },
        data: { 
          tier: newTier,
          monthlyBuilds: 0, // 👈 RESETS BUILD COUNTER TO 0 ON TIER UPGRADE
        },
      });

      console.log(`✅ Updated ${result.count} user(s) to tier: ${newTier}`);
      break;
    }

    // 👉 TRIGGERED WHEN A SUB IS CANCELED OR PAYMENT FAILS
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const stripeCustomerId = subscription.customer as string;

      // 👉 ADDED: Match by stripeCustomerId OR stripeSubscriptionId so it never misses
      const result = await db.user.updateMany({
        where: {
          OR: [
            { stripeCustomerId: stripeCustomerId },
            { stripeSubscriptionId: subscription.id },
          ],
        },
        data: {
          tier: "free",
          stripeSubscriptionId: null,
        },
      });

      console.log(`🚨 Canceled subscription for ${result.count} user(s)`);
      break;
    }
  }

  return new NextResponse(null, { status: 200 });
}
