import { Router } from "express";
import { SignJWT } from "jose";
import { upsertUser } from "./db";

export const authRouter = Router();

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "super-secret-clubdna-key-change-me");
const APP_URL = "https://baller-engine.onrender.com"; 

const DISCORD_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Accept": "application/json",
  "Accept-Language": "en-US,en;q=0.9",
};

// Helper function to retry requests if hit with Cloudflare 429 rate limit
async function fetchDiscordWithRetry(url: string, options: RequestInit, retries = 2): Promise<Response> {
  let response = await fetch(url, options);
  
  if (response.status === 429 && retries > 0) {
    console.warn(`[OAuth] Rate limited (429). Retrying in 2 seconds... (${retries} retries left)`);
    await new Promise((res) => setTimeout(res, 2000));
    return fetchDiscordWithRetry(url, options, retries - 1);
  }
  
  return response;
}

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
    // A. Trade code for token (with auto-retry on 429)
    const tokenResponse = await fetchDiscordWithRetry("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { 
        "Content-Type": "application/x-www-form-urlencoded",
        ...DISCORD_HEADERS,
      },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID!,
        client_secret: process.env.DISCORD_CLIENT_SECRET!,
        grant_type: "authorization_code",
        code: code,
        redirect_uri: `${APP_URL}/api/auth/discord/callback`,
      }),
    });

    const rawTokenText = await tokenResponse.text();

    if (!tokenResponse.ok) {
      console.error("Discord Token Exchange Failed. Status:", tokenResponse.status);
      console.error("Raw Discord Response Body:", rawTokenText);
      return res.redirect("/?error=DiscordTokenFailed");
    }

    const tokenData = JSON.parse(rawTokenText);

    // B. Fetch profile (with auto-retry on 429)
    const userResponse = await fetchDiscordWithRetry("https://discord.com/api/users/@me", {
      headers: { 
        Authorization: `Bearer ${tokenData.access_token}`,
        ...DISCORD_HEADERS,
      },
    });

    const rawUserText = await userResponse.text();

    if (!userResponse.ok) {
      console.error("Discord User Fetch Failed. Status:", userResponse.status);
      console.error("Raw User Response Body:", rawUserText);
      return res.redirect("/?error=DiscordUserFailed");
    }

    const discordUser = JSON.parse(rawUserText);

    if (!discordUser.id) {
      throw new Error("Discord failed to return user ID. Check your OAuth scopes.");
    }

    let avatarUrl = null;
    if (discordUser.avatar) {
      avatarUrl = `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`;
    }

    await upsertUser({
      openId: discordUser.id,
      name: discordUser.username || "Unknown",
      email: discordUser.email || null,
      loginMethod: "discord",
      avatar: avatarUrl,
    });

    const token = await new SignJWT({ userId: discordUser.id })
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
