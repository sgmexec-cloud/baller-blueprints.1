export const PREVIEW_COOKIE = "clubdna_preview_tier";
export const PREVIEW_TIERS = ["free", "premium", "premium_plus", "vip"] as const;

/**
 * The plan a user is treated as having RIGHT NOW.
 * Only the owner can preview another plan. For everyone else the cookie is ignored completely, so nobody
 * can give themselves a better plan by editing a cookie.
 */
export function resolveEffectiveTier(realTier: string, previewCookie: string | undefined | null): string {
  if (realTier !== "owner") return realTier;
  return previewCookie && (PREVIEW_TIERS as readonly string[]).includes(previewCookie) ? previewCookie : realTier;
}
