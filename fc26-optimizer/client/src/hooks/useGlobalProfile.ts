import { trpc } from "@/lib/trpc";
import { useEffect } from "react";

export function useGlobalProfile(
  isAuthenticated: boolean,
  onApplyProfile: (profile: {
    clubLevel: number;
    equippedFacilities: Record<string, number>;
    unlockedMasteries: Record<string, { l10: boolean; l30: boolean }>;
  }) => void
) {
  const profileQuery = trpc.scout.builds.profileGet.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (profileQuery.data) {
      onApplyProfile(profileQuery.data);
    }
  }, [profileQuery.data]);

  return {
    profile: profileQuery.data ?? null,
    isLoading: profileQuery.isLoading,
  };
}
