import fs from "fs/promises";
import path from "path";

export async function calculateEligiblePlayStyles(
  finalStats: Record<string, number>,
  customSlots: number,
  signatureUpgrades: number,
  archetype: string
) {
  const filePath = path.join(process.cwd(), "server", "data", "PLAYSTYLES.csv");
  const fileContent = await fs.readFile(filePath, "utf-8");
  const lines = fileContent.trim().split("\n");

  const eligibleStandard: string[] = [];

  // Start at i=1 to skip the header row
  for (let i = 1; i < lines.length; i++) {
    // Split by comma (handles blank columns safely)
    const parts = lines[i].split(",");
    const playstyleName = parts[0]?.trim();
    if (!playstyleName) continue;

    let isEligible = true;

    // Loop through Attr1/Val1, Attr2/Val2, Attr3/Val3
    for (let j = 1; j < parts.length; j += 2) {
      const attrName = parts[j]?.trim();
      const requiredValue = parseInt(parts[j + 1]?.trim(), 10);

      if (attrName && !isNaN(requiredValue)) {
        // Convert CSV attribute name (e.g., "BallControl") to match MathEngine keys (e.g., "ballControl")
        const statKey = attrName.charAt(0).toLowerCase() + attrName.slice(1);
        
        const actualValue = finalStats[statKey] || 0;
        
        // If the player fails even one requirement, they don't get the PlayStyle
        if (actualValue < requiredValue) {
          isEligible = false;
          break;
        }
      }
    }

    if (isEligible) {
      eligibleStandard.push(playstyleName);
    }
  }

  // Cap the equipped standard playstyles based on the user's unlocked slots
  const equippedStandard = eligibleStandard.slice(0, customSlots);

  // Generate placeholders for the Signature Upgrades based on their level
  const equippedSignatures = Array.from(
    { length: signatureUpgrades },
    (_, i) => `${archetype} Signature+ ${i + 1}`
  );

  return {
    signatures: equippedSignatures,
    standard: equippedStandard,
    specialisation: null, // Placeholder for future specialisation logic
  };
}
