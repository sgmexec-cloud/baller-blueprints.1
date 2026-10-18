import { Router } from "express";
import { SignJWT } from "jose";
import { randomInt } from "crypto";
import { upsertUser, setOtpCode, verifyOtpCode } from "./db";
import { getJwtSecret } from "./_core/jwtSecret";
import { hit, peek, reset } from "./_core/rateLimit";

export const authRouter = Router();

const MIN = 60 * 1000;
const HOUR = 60 * MIN;

// Helper function to normalize emails (blocks plus-aliasing and the gmail dots trick)
function normalizeEmail(rawEmail: string): string {
  let email = rawEmail.toLowerCase().trim();
  // Strip anything between a '+' and the '@' symbol
  email = email.replace(/\+[^@]*@/, "@");
  // googlemail.com is the same mailbox as gmail.com
  if (email.endsWith("@googlemail.com")) email = email.replace(/@googlemail\.com$/, "@gmail.com");
  // If it's Gmail, remove all dots from the local part of the email
  if (email.endsWith("@gmail.com")) {
    const parts = email.split("@");
    if (parts.length === 2) {
      email = `${parts[0].replace(/\./g, "")}@${parts[1]}`;
    }
  }
  return email;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Burner-domain list: cached for 24h so one slow/failed GitHub request can't block logins ──
let burnerCache: { domains: Set<string>; fetchedAt: number } | null = null;

async function isBurnerDomain(domain: string): Promise<boolean> {
  const now = Date.now();
  if (!burnerCache || now - burnerCache.fetchedAt > 24 * HOUR) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(
        "https://raw.githubusercontent.com/disposable/disposable-email-domains/master/domains.json",
        { signal: controller.signal }
      );
      clearTimeout(timer);
      if (res.ok) {
        const list = (await res.json()) as string[];
        burnerCache = { domains: new Set(list), fetchedAt: now };
      }
    } catch (err) {
      console.error("Burner list fetch failed (continuing without it):", err);
    }
  }
  return burnerCache ? burnerCache.domains.has(domain) : false; // fail-open if the list is unavailable
}

// ── 1. Route to Generate & Send the Code ──
authRouter.post("/send-otp", async (req, res) => {
  const rawEmail = req.body?.email;
  if (typeof rawEmail !== "string" || rawEmail.length > 254 || !EMAIL_RE.test(rawEmail.trim())) {
    return res.status(400).json({ error: "Invalid email address" });
  }

  const email = normalizeEmail(rawEmail);
  const ip = req.ip || "unknown";

  // Rate limits: stops anyone using this endpoint to spam inboxes or mass-create accounts
  const limits = [
    hit(`send:ip:${ip}`, 20, HOUR),
    hit(`send:cooldown:${email}`, 1, 45 * 1000),
    hit(`send:email:${email}`, 5, HOUR),
  ];
  const blocked = limits.find(l => !l.ok);
  if (blocked) {
    return res
      .status(429)
      .json({ error: `Too many requests. Please try again in ${blocked.retryAfterSec} seconds.` });
  }

  try {
    // A. Anti-Burner Check
    const domain = email.split("@")[1];
    if (await isBurnerDomain(domain)) {
      return res.status(400).json({ error: "Please use a permanent email address, temporary emails are blocked." });
    }

    // B. Generate a 6-digit code with a cryptographically secure generator
    const otp = randomInt(100000, 1000000).toString();
    const expires = new Date(Date.now() + 10 * MIN); // Expires in 10 minutes

    // C. Save to Database (a first-time email creates a free account)
    await upsertUser({ openId: email, name: email.split("@")[0], email: email, loginMethod: "email", avatar: null });
    await setOtpCode(email, otp, expires);

    // D. Send Email via Resend API using Verified Domain
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "ClubsDNA <login@clubsdna.co.uk>",
        to: email,
        subject: "Your ClubsDNA Login Code",
        html: `<h2>Welcome to ClubsDNA</h2><p>Your 6-digit login code is: <strong>${otp}</strong></p><p>This code expires in 10 minutes.</p>`,
      }),
    });

    if (!emailRes.ok) {
      const errorData = await emailRes.json().catch(() => ({}));
      console.error("🚨 RESEND REJECTED THE EMAIL:", errorData);
      throw new Error("Failed to send email via Resend");
    }

    res.json({ success: true, message: "Code sent!" });
  } catch (error) {
    console.error("OTP Send Error:", error);
    res.status(500).json({ error: "Failed to send code. Please try again." });
  }
});

// ── 2. Route to Verify the Code & Log Them In ──
authRouter.post("/verify-otp", async (req, res) => {
  const rawEmail = req.body?.email;
  const rawCode = req.body?.code;
  if (typeof rawEmail !== "string" || rawCode === undefined || rawCode === null) {
    return res.status(400).json({ error: "Missing email or code" });
  }

  const code = String(rawCode).trim();
  if (!/^\d{6}$/.test(code)) {
    return res.status(400).json({ error: "Enter the 6-digit code from your email." });
  }

  const email = normalizeEmail(rawEmail);
  const ip = req.ip || "unknown";

  // Brute-force protection: only 5 wrong guesses per email (and 30 per IP) every 15 minutes.
  // A 6-digit code has only 1,000,000 possibilities, so without this it can be guessed.
  const emailKey = `verify:email:${email}`;
  const ipKey = `verify:ip:${ip}`;
  const locked = [peek(emailKey, 5, 15 * MIN), peek(ipKey, 30, 15 * MIN)].find(l => !l.ok);
  if (locked) {
    return res
      .status(429)
      .json({ error: `Too many incorrect attempts. Please try again in ${Math.ceil(locked.retryAfterSec / 60)} minutes.` });
  }

  try {
    // A. Check the DB for the code
    const user = await verifyOtpCode(email, code);

    if (!user) {
      hit(emailKey, 5, 15 * MIN);
      hit(ipKey, 30, 15 * MIN);
      return res.status(401).json({ error: "Invalid or expired code." });
    }

    reset(emailKey);

    // B. Create the Login Cookie
    const token = await new SignJWT({ userId: user.openId })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(getJwtSecret());

    res.cookie("clubdna_auth", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ success: true, message: "Logged in successfully!" });
  } catch (error) {
    console.error("OTP Verify Error:", error);
    res.status(500).json({ error: "Failed to verify code." });
  }
});

// ── 3. The Logout Doorway ──
authRouter.get("/logout", (req, res) => {
  res.clearCookie("clubdna_auth", { path: "/" });
  res.redirect("/");
});
