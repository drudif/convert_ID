import { mulberry32 } from '../lib/prng';
import type { Composition, CompositionBlob, Palette } from '../types';

const RADIUS_MIN = 0.2;
const RADIUS_MAX = 0.5;
const SUBCENTER_COUNT = 3;        // satellites per blob
const SUBCENTER_R_MIN = 0.7;
const SUBCENTER_R_RANGE = 0.25;   // rf ∈ [0.7, 0.95] — satellite almost as big as primary
                                  // so its Centro region always overlaps the primary's

function weightedPick(rng: () => number, weights: number[]): number {
  const total = weights.reduce((s, w) => s + w, 0);
  let r = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

export function generateComposition(
  seed: number,
  blobCount: number,
  palette: Palette,
): Composition {
  const rng = mulberry32(seed);
  const weights =
    palette.variantWeights ?? palette.blobVariants.map(() => 1);

  const blobs: CompositionBlob[] = [];
  for (let i = 0; i < blobCount; i++) {
    const cx = rng();
    const cy = rng();
    const baseR = RADIUS_MIN + rng() * (RADIUS_MAX - RADIUS_MIN);
    const variantIdx = weightedPick(rng, weights);

    // Three off-centre satellites positioned within ~0.7·baseR of the primary.
    // Their metaball fields add to the primary's, producing bulges in their
    // directions — non-radial protrusions, asymmetric organic silhouettes.
    const subcenters = [];
    for (let s = 0; s < SUBCENTER_COUNT; s++) {
      subcenters.push({
        ox: rng() * 2 - 1,
        oy: rng() * 2 - 1,
        rf: SUBCENTER_R_MIN + rng() * SUBCENTER_R_RANGE,
      });
    }
    const harmonics = { subcenters };

    blobs.push({ x: cx, y: cy, radius: baseR, variantIdx, harmonics });
  }
  return { seed, blobs };
}
