import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe"; // 👈 Adjust this if your stripe.ts is somewhere else
import { db } from "@/lib/db";         // 👈 Adjust this if your Prisma file is somewhere else
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
    console.error("Webhook signature verification failed.", error.message);
    return new NextResponse(`Webhook Error: ${error.message}`, { status: 400 });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  // 2. Handle the different subscription lifecycle events
  switch (event.type) {
    
    // 👉 TRIGGERED WHEN A USER BUYS A SUB FOR THE FIRST TIME
    case "checkout.session.completed": {
      const userId = session.metadata?.userId;
      const stripeCustomerId = session.customer as string;

      if (!userId) break;

      const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
      const priceId = subscription.items.data[0].price.id;
      const newTier = getTierFromPriceId(priceId);

      await db.user.update({
        where: { id: userId },
        data: {
          tier: newTier,
          stripeCustomerId: stripeCustomerId,
          stripeSubscriptionId: subscription.id,
        },
      });
      break;
    }

    // 👉 TRIGGERED WHEN A USER UPGRADES OR DOWNGRADES TIERS
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const stripeCustomerId = subscription.customer as string;
      const priceId = subscription.items.data[0].price.id;
      const newTier = getTierFromPriceId(priceId);

      await db.user.updateMany({
        where: { stripeCustomerId: stripeCustomerId },
        data: { tier: newTier },
      });
      break;
    }

    // 👉 TRIGGERED WHEN A SUB IS CANCELED OR PAYMENT FAILS
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const stripeCustomerId = subscription.customer as string;

      await db.user.updateMany({
        where: { stripeCustomerId: stripeCustomerId },
        data: {
          tier: "free",
          stripeSubscriptionId: null,
        },
      });
      break;
    }
  }

  return new NextResponse(null, { status: 200 });
}
