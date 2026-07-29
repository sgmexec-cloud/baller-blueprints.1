import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import Stripe from "stripe";

// 1. Give Stripe your Secret Key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20", 
});

// Map your tiers to the price IDs in your .env
const PRICE_MAP: Record<string, string> = {
  premium: process.env.STRIPE_PRICE_PREMIUM!,
  premium_plus: process.env.STRIPE_PRICE_PREMIUM_PLUS!,
  vip: process.env.STRIPE_PRICE_VIP!,
};

export const stripeRouter = router({
  createCheckout: publicProcedure
    // 👉 ADDED: Accept the specific tier the user clicked on in the Pricing Modal
    .input(
      z.object({
        tier: z.enum(["premium", "premium_plus", "vip"]).default("premium"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = (ctx as any).userId;
      
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "You must log in first!" });
      }

      const priceId = PRICE_MAP[input.tier];
      if (!priceId) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Invalid price configuration" });
      }

      // Figure out your website's web address
      const headers = (ctx as any).req?.headers || (ctx as any).headers || {};
      const domain = headers.origin || "http://localhost:3000";

      // Ask Stripe to create a secure payment link
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price: priceId, // Uses the exact price tag for the tier they selected
            quantity: 1,
          },
        ],
        mode: "subscription",
        client_reference_id: userId, 
        // Pass extra data so the webhook knows exactly who bought what
        metadata: {
          userId: userId,
          tier: input.tier,
        },
        success_url: `${domain}/?upgrade=success`,
        cancel_url: `${domain}/?upgrade=canceled`,
      });

      if (!session.url) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create Stripe link" });
      }

      return { checkoutUrl: session.url };
    }),
});
