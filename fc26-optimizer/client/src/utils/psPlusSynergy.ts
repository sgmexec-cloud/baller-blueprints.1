import { PLAYSTYLES_DATA } from '@/constants/playstylesData';

/**
 * A build can only have ONE Playstyle+ equipped. When a specialisation unlocks a second
 * one, this picks whichever fits the build better ("synergy"):
 *
 *  1. AI builds: where the candidate sits in the blueprint's ranked Playstyle+ list (strongest signal)
 *  2. How well the build's current stats already meet that playstyle's attribute requirements
 *  3. How many of its requirement attributes are the build's core/secondary (focus) attributes
 *
 * A tie goes to the specialisation, because it is the newly unlocked (and costlier) option.
 */

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const baseName = (s: string) => s.replace(/\+/g, '').trim().toLowerCase();

export interface PsPlusPickInput {
  /** Archetype signature Playstyle+, e.g. 'Bruiser' */
  signature: string;
  /** Specialisation Playstyle+, e.g. 'Slide Tackle+' */
  spec: string;
  /** Returns the build's current value for an attribute name, e.g. 'Strength' */
  getStat: (stat: string) => number;
  /** AI blueprint.playstylePlus, best first (optional) */
  rankedPreferences?: string[];
  /** AI core + secondary attributes (optional) */
  focusAttributes?: string[];
}

export function pickBestPlaystylePlus(input: PsPlusPickInput): 'signature' | 'spec' {
  if (!input.signature || input.signature === 'None') return 'spec';

  const focus = (input.focusAttributes ?? []).map(norm);

  const score = (name: string) => {
    const key = baseName(name);
    let s = 0;

    const rank = (input.rankedPreferences ?? []).findIndex((p) => baseName(p) === key);
    if (rank >= 0) s += (5 - Math.min(rank, 4)) * 100;

    const def = PLAYSTYLES_DATA.find((p) => p.name.toLowerCase() === key);
    if (def && def.reqs.length > 0) {
      const fit =
        def.reqs.reduce((sum, r) => sum + Math.min(1, input.getStat(r.stat) / r.min), 0) / def.reqs.length;
      s += fit * 50;
      s += def.reqs.filter((r) => focus.includes(norm(r.stat))).length * 10;
    } else {
      s += 25; // unknown playstyle: neutral score
    }
    return s;
  };

  return score(input.spec) >= score(input.signature) ? 'spec' : 'signature';
}
