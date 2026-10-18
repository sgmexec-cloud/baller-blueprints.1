/**
 * Single place that supplies the session-signing secret.
 *
 * The old code fell back to a hard-coded string when JWT_SECRET was missing. Anyone who has seen that
 * string could sign their own login cookie for ANY email (including your owner account). In
 * production this now refuses to run without a real secret instead of silently using a known one.
 */
export function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET is missing or too short (use a random string of 32+ characters).");
    }
    return new TextEncoder().encode("dev-only-insecure-secret-do-not-use-in-production");
  }
  return new TextEncoder().encode(secret);
}
