import { getLoginUrl } from '@/const';

/**
 * Where "Log in" sends people.
 *
 * getLoginUrl() builds the Manus OAuth portal URL from VITE_OAUTH_PORTAL_URL. If that variable
 * isn't set on this deployment, it throws "TypeError: Invalid URL", and when that happened during
 * render it crashed the whole page. This wrapper never throws: it uses the OAuth URL when it works
 * and otherwise falls back to your own login page.
 *
 * 👉 Set LOGIN_PATH to the route of your login page (the one that uses the email/OTP login).
 */
export const LOGIN_PATH = '/login';

export function getSafeLoginUrl(): string {
  try {
    const url = getLoginUrl();
    if (url) return url;
  } catch (_err) {
    // VITE_OAUTH_PORTAL_URL is missing or malformed on this deployment
  }
  return LOGIN_PATH;
}
