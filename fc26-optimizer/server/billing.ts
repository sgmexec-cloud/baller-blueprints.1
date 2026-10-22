import { Router, type Request, type Response } from "express";
import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import { createContext } from "./_core/context";

/**
 * Billing endpoints (all require a logged-in user):
 *   POST /api/billing/checkout     { plan }  -> Stripe Checkout URL for a NEW subscription
 *   POST /api/billing/change-plan  { plan }  -> upgrade an existing subscription in place (prorated, charged now)
 *   POST /api/billing/portal                 -> Stripe customer portal URL (payment method, invoices, downgrade, cancel)
 *
 * The webhook in _core/index.ts stays the source of truth for tier changes; change-plan also applies the
 * new tier straight away so the user doesn't wait for the webhook.
 */
export const billingRouter = Router();

type PaidTier = "premium" | "premium_plus" | "vip";
const RANK: Record<string, number> = { free: 0, premium: 1, premium_plus: 2, vip: 3 };

let stripeClient: Stripe | null = null;
function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is not set");
  if (!stripeClient) stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
  return stripeClient;
}

function priceFor(plan: string): string | null {
  const map: Record<PaidTier, string | undefined> = {
    premium: process.env.STRIPE_PRICE_PREMIUM,
    premium_plus: process.env.STRIPE_PRICE_PREMIUM_PLUS,
    vip: process.env.STRIPE_PRICE_VIP,
  };
  return map[plan as PaidTier]?.trim() || null;
}

// Prefer APP_URL (e.g. https://clubsdna.co.uk) so redirect URLs can't be steered by a forged Host header
function appOrigin(req: Request): string {
  return (process.env.APP_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
}


// The webhook writes the purchased plan onto the account. If the owner subscribed by accident (for example while
// previewing the Free plan), it would overwrite "owner". So owners can't use these endpoints.
function isOwner(user: any): boolean {
  return (user?.realTier ?? user?.tier) === "owner";
}
const OWNER_BLOCK = "Owner accounts can't subscribe or change plans. This protects your owner access.";

async function currentUser(req: Request, res: Response) {
  const { user } = await createContext({ req, res } as any);
  return user;
}

function sendError(res: Response, err: any) {
  console.error("Billing error:", err);
  if (err?.code === "subscription_payment_intent_requires_action") {
    return res.status(402).json({
      error: "Your bank needs to verify this payment. Open Manage billing, check your card, then try again.",
    });
  }
  if (err?.type === "StripeCardError") {
    return res.status(402).json({ error: err.message || "Your card was declined." });
  }
  return res.status(500).json({ error: "Something went wrong with billing. Please try again." });
}

// ── Start a NEW subscription (free user -> paid) ──
billingRouter.post("/checkout", async (req, res) => {
  try {
    const user = await currentUser(req, res);
    if (!user) return res.status(401).json({ error: "Please log in first." });
    if (isOwner(user)) return res.status(403).json({ error: OWNER_BLOCK });

    const plan = String(req.body?.plan ?? "");
    const price = priceFor(plan);
    if (!price) return res.status(400).json({ error: "Unknown plan." });

    if (user.stripeSubscriptionId && user.tier !== "free") {
      return res.status(409).json({ error: "You already have a subscription. Upgrade it from the plans page." });
    }

    const origin = appOrigin(req);
    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      // The webhook finds the account from this (users.openId)
      client_reference_id: user.openId,
      // Re-use the Stripe customer if they've subscribed before, otherwise pre-fill their email
      ...(user.stripeCustomerId
        ? { customer: user.stripeCustomerId }
        : user.email
          ? { customer_email: user.email }
          : {}),
      allow_promotion_codes: true,
      success_url: `${origin}/pricing?checkout=success`,
      cancel_url: `${origin}/pricing?checkout=cancelled`,
    });

    res.json({ url: session.url });
  } catch (err) {
    sendError(res, err);
  }
});

// ── UPGRADE an existing subscription (prorated, billed immediately) ──
billingRouter.post("/change-plan", async (req, res) => {
  try {
    const user = await currentUser(req, res);
    if (!user) return res.status(401).json({ error: "Please log in first." });
    if (isOwner(user)) return res.status(403).json({ error: OWNER_BLOCK });

    const plan = String(req.body?.plan ?? "");
    const price = priceFor(plan);
    if (!price) return res.status(400).json({ error: "Unknown plan." });

    if (!user.stripeSubscriptionId) {
      return res.status(400).json({ error: "You don't have a subscription yet. Subscribe to a plan first." });
    }
    // Only upgrades here. Downgrades and cancellations go through the billing portal.
    if ((RANK[plan] ?? 0) <= (RANK[user.tier] ?? 0)) {
      return res.status(400).json({
        error: "To downgrade or cancel, use Manage billing. Upgrades are instant.",
      });
    }

    const stripe = getStripe();
    const sub = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
    if (!["active", "trialing"].includes(sub.status)) {
      return res.status(400).json({ error: "Your subscription isn't active. Open Manage billing to fix your payment." });
    }
    const item = sub.items.data[0];
    if (item.price.id === price) {
      return res.status(400).json({ error: "You're already on this plan." });
    }

    await stripe.subscriptions.update(sub.id, {
      items: [{ id: item.id, price }],
      // Charge the prorated difference NOW; if the payment fails the plan does not change
      proration_behavior: "always_invoice",
      payment_behavior: "error_if_incomplete",
      cancel_at_period_end: false,
    });

    // Apply straight away (the webhook will set the same tier). The used-builds count is NOT reset:
    // the user keeps what they've used this month and simply gets the higher allowance.
    const db = await getDb();
    if (db) {
      await db.update(users).set({ tier: plan as PaidTier }).where(eq(users.id, user.id));
    }

    res.json({ success: true, tier: plan });
  } catch (err) {
    sendError(res, err);
  }
});

// ── Stripe customer portal (update card, see invoices, downgrade, cancel) ──
billingRouter.post("/portal", async (req, res) => {
  try {
    const user = await currentUser(req, res);
    if (!user) return res.status(401).json({ error: "Please log in first." });
    if (!user.stripeCustomerId) {
      return res.status(400).json({ error: "No billing account found yet. Subscribe to a plan first." });
    }

    const session = await getStripe().billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${appOrigin(req)}/pricing`,
    });
    res.json({ url: session.url });
  } catch (err) {
    sendError(res, err);
  }
});
