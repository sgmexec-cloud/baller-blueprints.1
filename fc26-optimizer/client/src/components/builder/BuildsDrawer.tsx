import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { X, Bookmark, Copy, Trash2, Plus, Sparkles, Check, Lock } from "lucide-react";
import { useLocation } from "wouter";

interface BuildsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentBuilderData: any; // Current state snapshot from ManualBuilder
  onLoadBuild: (data: any) => void; // Restores snapshot into builder state
  currentProfileData: {
    clubLevel: number;
    equippedFacilities: Record<string, number>;
    unlockedMasteries: Record<string, { l10: boolean; l30: boolean }>;
  };
}

export const BuildsDrawer: React.FC<BuildsDrawerProps> = ({
  isOpen,
  onClose,
  currentBuilderData,
  onLoadBuild,
  currentProfileData,
}) => {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [buildName, setBuildName] = useState("");
  const [selectedBuildId, setSelectedBuildId] = useState<number | null>(null);
  const [profileSavedToast, setProfileSavedToast] = useState(false);

  // Queries & Mutations
  const listQuery = trpc.scout.builds.list.useQuery(undefined, { enabled: isOpen });
  const getQuery = trpc.scout.builds.get.useQuery(
    { id: selectedBuildId! },
    { enabled: selectedBuildId !== null }
  );

  const saveMutation = trpc.scout.builds.save.useMutation({
    onSuccess: () => {
      utils.scout.builds.list.invalidate();
      setBuildName("");
    },
  });

  const duplicateMutation = trpc.scout.builds.duplicate.useMutation({
    onSuccess: () => utils.scout.builds.list.invalidate(),
  });

  const removeMutation = trpc.scout.builds.remove.useMutation({
    onSuccess: () => utils.scout.builds.list.invalidate(),
  });

  const profileSaveMutation = trpc.scout.builds.profileSave.useMutation({
    onSuccess: () => {
      utils.scout.builds.profileGet.invalidate();
      setProfileSavedToast(true);
      setTimeout(() => setProfileSavedToast(false), 3000);
    },
  });

  if (!isOpen) return null;

  const builds = listQuery.data?.builds ?? [];
  const used = listQuery.data?.used ?? 0;
  const limit = listQuery.data?.limit;
  const canSaveProfile = listQuery.data?.canSaveProfile ?? false;
  const isAtLimit = limit !== null && used >= limit;

  const handleSaveNew = () => {
    if (!buildName.trim()) return;
    saveMutation.mutate({
      name: buildName.trim(),
      data: {
        v: 1,
        ...currentBuilderData,
        ...currentProfileData,
      },
    });
  };

  const handleLoad = async (id: number) => {
    setSelectedBuildId(id);
    const buildData = await utils.scout.builds.get.fetch({ id });
    if (buildData) {
      onLoadBuild(buildData);
      onClose();
    }
  };

  const handleSaveProfile = () => {
    profileSaveMutation.mutate({ data: currentProfileData });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-[#080B14] border-l border-[#26334A] h-full flex flex-col p-6 shadow-2xl relative overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#26334A]">
          <div className="flex items-center gap-2">
            <Bookmark className="w-5 h-5 text-[#4D8DFF]" />
            <h2 className="text-base font-black text-[#F4F7FB] uppercase tracking-widest" style={{ fontFamily: "'Orbitron', sans-serif" }}>
              Build Library
            </h2>
          </div>
          <button onClick={onClose} className="text-[#8E9AAF] hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Profile Quick-Save Section */}
        <div className="mt-4 p-4 rounded-xl bg-[#131A2A] border border-[#26334A]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs font-bold text-[#F4F7FB]">
              <Sparkles className="w-4 h-4 text-[#21E6A4]" />
              Default Setup Profile
            </div>
            {!canSaveProfile && (
              <span className="flex items-center gap-1 text-[10px] font-black text-[#facc15] bg-[#facc15]/10 px-2 py-0.5 rounded-full">
                <Lock className="w-3 h-3" /> Paid Feature
              </span>
            )}
          </div>
          <p className="text-[11px] text-[#8E9AAF] leading-relaxed mb-3">
            Save your current Facilities and Masteries as default to auto-apply them to all new builds.
          </p>

          {canSaveProfile ? (
            <button
              onClick={handleSaveProfile}
              disabled={profileSaveMutation.isPending}
              className="w-full py-2 rounded-lg bg-[#192235] border border-[#4D8DFF]/40 hover:border-[#4D8DFF] text-[#F4F7FB] text-xs font-bold transition-all flex items-center justify-center gap-2"
            >
              {profileSavedToast ? (
                <>
                  <Check className="w-4 h-4 text-[#21E6A4]" /> Saved as Default!
                </>
              ) : (
                "Save Current Setup as Default"
              )}
            </button>
          ) : (
            <button
              onClick={() => setLocation("/pricing")}
              className="w-full py-2 rounded-lg bg-gradient-to-r from-[#4D8DFF] to-[#8B5CF6] text-white text-xs font-bold transition-all"
            >
              Upgrade to Save Default Setup
            </button>
          )}
        </div>

        {/* Save Current Build Form */}
        <div className="mt-6 space-y-3">
          <div className="flex justify-between text-xs font-bold">
            <span className="text-[#8E9AAF] uppercase tracking-widest">Save Current Build</span>
            <span className={isAtLimit ? "text-[#facc15]" : "text-[#21E6A4]"}>
              {used} / {limit === null ? "∞" : limit} Slots Used
            </span>
          </div>

          {isAtLimit ? (
            <div className="p-3 rounded-xl bg-[#facc15]/10 border border-[#facc15]/30 text-center">
              <p className="text-xs text-[#facc15] font-semibold mb-2">Build storage limit reached.</p>
              <button
                onClick={() => setLocation("/pricing")}
                className="text-xs font-black text-white underline hover:text-[#4D8DFF]"
              >
                Upgrade plan for more slots
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Build name (e.g. VPG Winger V1)"
                value={buildName}
                onChange={e => setBuildName(e.target.value)}
                className="flex-1 bg-[#131A2A] border border-[#26334A] rounded-xl px-3 py-2 text-xs text-[#F4F7FB] focus:outline-none focus:border-[#4D8DFF]"
              />
              <button
                onClick={handleSaveNew}
                disabled={!buildName.trim() || saveMutation.isPending}
                className="px-4 py-2 bg-[#4D8DFF] hover:bg-[#3b72df] text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50 flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> Save
              </button>
            </div>
          )}
        </div>

        {/* Saved Builds List */}
        <div className="mt-6 flex-1 space-y-3 overflow-y-auto">
          <span className="text-xs font-bold text-[#8E9AAF] uppercase tracking-widest block mb-2">
            Your Builds
          </span>

          {listQuery.isLoading ? (
            <div className="text-xs text-[#8E9AAF] text-center py-8">Loading library...</div>
          ) : builds.length === 0 ? (
            <div className="text-xs text-[#8E9AAF] text-center py-8 bg-[#131A2A]/50 rounded-xl border border-dashed border-[#26334A]">
              No saved builds yet.
            </div>
          ) : (
            builds.map(b => (
              <div
                key={b.id}
                className="p-3 rounded-xl bg-[#131A2A] border border-[#26334A] hover:border-[#4D8DFF]/50 transition-all flex items-center justify-between group"
              >
                <div className="cursor-pointer flex-1" onClick={() => handleLoad(b.id)}>
                  <div className="text-xs font-bold text-[#F4F7FB] group-hover:text-[#4D8DFF] transition-colors">
                    {b.name}
                  </div>
                  <div className="text-[10px] text-[#8E9AAF] mt-0.5">
                    {b.archetype} • Level {b.level}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => duplicateMutation.mutate({ id: b.id })}
                    title="Duplicate build"
                    className="p-1.5 text-[#8E9AAF] hover:text-[#21E6A4] transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => removeMutation.mutate({ id: b.id })}
                    title="Delete build"
                    className="p-1.5 text-[#8E9AAF] hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
};
