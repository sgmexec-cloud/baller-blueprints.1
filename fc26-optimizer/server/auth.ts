import { Router } from "express";
import { SignJWT } from "jose";
import { upsertUser } from "./db";

export const authRouter = Router();

// Our secret key for locking the user's login cookie
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "super-secret-clubdna-key-change-me");

// Your live website URL
const APP_URL = "https://baller-engine.onrender.com"; 

// ── 1. The Login Doorway (Sends user to Discord) ──
authRouter.get("/discord", (req, res) => {
  const redirectUri = encodeURIComponent(`${APP_URL}/api/auth/discord/callback`);
  const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=identify%20email`;
  res.redirect(discordAuthUrl);
});

// ── 2. The Return Doorway (Discord sends them back here) ──
authRouter.get("/discord/callback", async (req, res) => {
  const code = req.query.code as string;
  if (!code) return res.redirect("/?error=NoCode");

  try {
    // A. Trade the secret code Discord gave us for an Access Token
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID!,
        client_secret: process.env.DISCORD_CLIENT_SECRET!,
        grant_type: "authorization_code",
        code: code,
        redirect_uri: `${APP_URL}/api/auth/discord/callback`,
      }),
    });
    const tokenData = await tokenResponse.json();

    // B. Use the token to get their Discord profile (Username, ID, etc.)
    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const discordUser = await userResponse.json();

    // DEBUG: Log the data to see what Discord actually returned
    console.log("Discord User Data Received:", JSON.stringify(discordUser, null, 2));

    // C. Validation: Ensure we actually got an ID
    if (!discordUser.id) {
      throw new Error("Discord failed to return user ID. Check your OAuth scopes.");
    }

    // 👉 NEW: Construct the Discord Avatar URL
    let avatarUrl = null;
    if (discordUser.avatar) {
      // Discord avatars are hosted at this specific CDN URL using their ID and Avatar Hash
      avatarUrl = `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`;
    }

    // Save this user into our Neon Postgres database!
    await upsertUser({
      openId: discordUser.id,
      name: discordUser.username || "Unknown",
      email: discordUser.email || null,
      loginMethod: "discord",
      avatar: avatarUrl, // 👉 NEW: Pass the avatar URL to the database function
    });

    // D. Create a secure "VIP Pass" (a Cookie) so they stay logged in
    const token = await new SignJWT({ userId: discordUser.id })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(JWT_SECRET);

    // E. Put the cookie in their browser and send them back to the homepage
    res.cookie("clubdna_auth", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", 
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000, 
    });

    res.redirect("/");
  } catch (error) {
    console.error("Discord Login Error:", error);
    res.redirect("/?error=LoginFailed");
  }
});

// ── 3. The Logout Doorway ──
authRouter.get("/logout", (req, res) => {
  res.clearCookie("clubdna_auth");
  res.redirect("/");
});
