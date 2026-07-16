import fs from "fs/promises";
import path from "path";

export async function calculateEligiblePlayStyles(
  finalStats: Record<string, number>,
  customSlots: number,
  signatureUpgrades: number,
  archetype: string
) {
  try {
    const filePath = path.join(process.cwd(), "server", "data", "PLAYSTYLES.csv");
    const fileContent = await fs.readFile(filePath, "utf-8");
    const lines = fileContent.trim().split("\n");

    const eligibleStandard: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(",");
      const playstyleName = parts[0]?.trim();
      if (!playstyleName) continue;

      let isEligible = true;

      // Loop through Attr1/Val1 (j=1,2), Attr2/Val2 (j=3,4), Attr3/Val3 (j=5,6)
      for (let j = 1; j < 6; j += 2) {
        const attrName = parts[j]?.trim();
        const rawVal = parts[j + 1]?.trim();
        const requiredValue = rawVal ? parseInt(rawVal, 10) : NaN;

        if (attrName && !isNaN(requiredValue)) {
          const statKey = attrName.charAt(0).toLowerCase() + attrName.slice(1);
          const actualValue = finalStats[statKey] || 0;
          
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

    return {
      signatures: Array.from({ length: Math.max(0, signatureUpgrades) }, (_, i) => `${archetype} Signature+ ${i + 1}`),
      standard: eligibleStandard.slice(0, Math.max(0, customSlots)) || [],
      specialisation: null,
    };
  } catch (error) {
    console.error("PlayStyle Calculation Error:", error);
    // Return empty arrays to prevent the frontend from crashing
    return { signatures: [], standard: [], specialisation: null };
  }
}
