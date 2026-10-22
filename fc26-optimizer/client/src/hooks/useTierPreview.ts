import { trpc } from "@/lib/trpc";

export type PreviewTier = "owner" | "free" | "premium" | "premium_plus" | "vip";

/** Owner-only testing helpers: view the app as another plan, and reset the AI build counter. */
export function useTierPreview() {
  const utils = trpc.useUtils();
  const setMutation = trpc.scout.setPreviewTier.useMutation();
  const resetMutation = trpc.scout.resetMyBuildCounter.useMutation();

  const setPreview = async (tier: PreviewTier) => {
    await setMutation.mutateAsync({ tier });
    // Everything the app shows depends on the plan, so refresh every query
    await utils.invalidate();
  };

  const resetCounter = async () => {
    await resetMutation.mutateAsync();
    await utils.scout.getQuota.invalidate();
  };

  return { setPreview, resetCounter, busy: setMutation.isPending || resetMutation.isPending };
}
