import { Router } from "express";
import { SignJWT } from "jose";
import { upsertUser, setOtpCode, verifyOtpCode } from "./db";

export const authRouter = Router();

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "super-secret-clubdna-key-change-me");

// Helper function to normalize emails (blocks plus-aliasing and gmail dots trick)
function normalizeEmail(rawEmail: string): string {
  let email = rawEmail.toLowerCase().trim();
  // Strip anything between a '+' and the '@' symbol
  email = email.replace(/\+[^@]*@/, '@');
  // If it's Gmail, remove all dots from the local part of the email
  if (email.endsWith('@gmail.com')) {
    const parts = email.split('@');
    if (parts.length === 2) {
      email = `${parts[0].replace(/\./g, '')}@${parts[1]}`;
    }
  }
  return email;
}

// ── 1. Route to Generate & Send the Code ──
authRouter.post("/send-otp", async (req, res) => {
  let { email } = req.body;
  if (!email || !email.includes("@")) return res.status(400).json({ error: "Invalid email address" });

  email = normalizeEmail(email);

  try {
    // A. Anti-Burner Check (Fetches live open-source list of spam domains)
    const domain = email.split("@")[1];
    const burnerRes = await fetch("https://raw.githubusercontent.com/disposable/disposable-email-domains/master/domains.json");
    const burnerDomains = await burnerRes.json();
    
    if (burnerDomains.includes(domain)) {
      return res.status(400).json({ error: "Please use a permanent email address, temporary emails are blocked." });
    }

    // B. Generate 6-Digit Code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // Expires in 10 minutes

    // C. Save to Database
    await upsertUser({ openId: email, name: email.split("@")[0], email: email, loginMethod: "email", avatar: null });
    await setOtpCode(email, otp, expires);

    // D. Send Email via Resend API using Verified Domain
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "ClubsDNA <login@clubsdna.co.uk>", 
        to: email,
        subject: "Your ClubsDNA Login Code",
        html: `<h2>Welcome to ClubsDNA</h2><p>Your 6-digit login code is: <strong>${otp}</strong></p><p>This code expires in 10 minutes.</p>`,
      }),
    });

    if (!emailRes.ok) throw new Error("Failed to send email via Resend");

    res.json({ success: true, message: "Code sent!" });
  } catch (error) {
    console.error("OTP Send Error:", error);
    res.status(500).json({ error: "Failed to send code. Please try again." });
  }
});

// ── 2. Route to Verify the Code & Log Them In ──
authRouter.post("/verify-otp", async (req, res) => {
  let { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: "Missing email or code" });

  email = normalizeEmail(email);

  try {
    // A. Check the DB for the code
    const user = await verifyOtpCode(email, code);
    
    if (!user) {
      return res.status(401).json({ error: "Invalid or expired code." });
    }

    // B. Create the Login Cookie
    const token = await new SignJWT({ userId: user.openId })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(JWT_SECRET);

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
  res.clearCookie("clubdna_auth");
  res.redirect("/");
});
