import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import Stripe from "stripe";

// 1. Give Stripe your Secret Key from the Render vault
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20", 
});

export const stripeRouter = router({
  createCheckout: publicProcedure.mutation(async ({ ctx }) => {
    // 👉 FIX: Look for userId instead of the full user object
    const userId = (ctx as any).userId;
    
    if (!userId) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "You must log in first!" });
    }

    // 3. Figure out your website's web address
    const headers = (ctx as any).req?.headers || (ctx as any).headers || {};
    const domain = headers.origin || "http://localhost:3000";

    // 4. Ask Stripe to create a secure payment link
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID, // Your specific price tag!
          quantity: 1,
        },
      ],
      mode: "subscription",
      // 👉 FIX: Use the userId directly since it is your Discord ID
      client_reference_id: userId, 
      // Where to send them after they pay or cancel
      success_url: `${domain}/?upgrade=success`,
      cancel_url: `${domain}/?upgrade=canceled`,
    });

    if (!session.url) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create Stripe link" });
    }

    // 5. Hand the link back to the front of the website
    return { checkoutUrl: session.url };
  }),
});
