import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import ExportPoster from "@/components/ExportPoster";
import type { Blueprint } from "../../../server/routers/scout";
import type { MathEngineResult } from "../../../server/mathEngine";

export default function CardPreview() {
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [playerCard, setPlayerCard] = useState<MathEngineResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 1. Extract Make.com variables from the URL
  const searchParams = new URLSearchParams(window.location.search);
  const name = searchParams.get("name") || "Pro Player";
  const archetype = searchParams.get("archetype") || "";
  const level = parseInt(searchParams.get("level") || "65", 10);
  const attributes = searchParams.get("attributes")
    ? searchParams.get("attributes")!.split(",")
    : [];

  const { data: progressionData } = trpc.build.getProgression.useQuery();

  const calcMutation = trpc.scout.calculateStats.useMutation({
    onSuccess: (data) => setPlayerCard(data),
    onError: (err) => setError(err.message),
  });

  const scoutMutation = trpc.scout.generateReport.useMutation({
    onSuccess: (data) => setBlueprint(data),
    onError: (err) => setError(err.message),
  });

  // 2. Automatically trigger the AI Scout on mount
  useEffect(() => {
    scoutMutation.mutate({
      playerIdentity: name,
      forcedArchetype: archetype || undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 3. Automatically trigger the Math Engine once the Blueprint is ready
  useEffect(() => {
    if (blueprint && progressionData && !playerCard && !calcMutation.isPending) {
      const apBudget = progressionData[level]?.apAvailable ?? 0;
      const sigSlots = progressionData[level]?.signatureUpgrades ?? 2;
      const stdSlots = progressionData[level]?.customSlots ?? 6;

      calcMutation.mutate({
        blueprint,
        apBudget,
        signatureSlots: sigSlots,
        standardSlots: stdSlots,
        preferredAttributes: attributes,
      } as any);
    }
  }, [blueprint, progressionData, playerCard, level, calcMutation, attributes]);

  // Handle Errors
  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-red-500 text-xl font-bold">
        Error generating build: {error}
      </div>
    );
  }

  // Show a loading state while the math engine works (Puppeteer will wait for this to disappear)
  if (!playerCard || !blueprint) {
    return (
      <div className="flex items-center justify-center w-[1080px] h-[1350px] bg-black text-green-500 text-4xl font-black uppercase tracking-widest" style={{ fontFamily: "'Orbitron', sans-serif" }}>
        Generating High-Res Build...
      </div>
    );
  }

  // 4. Render the final poster wrapped in the target ID for Puppeteer
  return (
    <div id="export-poster" className="w-[1080px] h-[1350px] bg-black overflow-hidden relative">
      <ExportPoster
        blueprint={blueprint}
        result={playerCard}
        apBudget={progressionData?.[level]?.apAvailable ?? 0}
        level={level}
      />
    </div>
  );
}
