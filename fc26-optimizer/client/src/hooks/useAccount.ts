import { trpc } from "@/lib/trpc";

/**
 * Who is logged in, using ONLY the email-code login (cookie + trpc.scout.me).
 * Replaces useAuth in the builder: useAuth depends on the Manus OAuth setup and on a trpc `auth`
 * router that this app doesn't have.
 */
export function useAccount() {
  const meQuery = trpc.scout.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  const user = meQuery.data ?? null;

  return {
    user,
    isAuthenticated: !!user,
    loading: meQuery.isLoading,
    // The server clears the cookie and redirects to "/"
    logout: () => {
      window.location.href = "/api/auth/logout";
    },
  };
}
