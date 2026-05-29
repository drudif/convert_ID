import { mulberry32 } from '../lib/prng';
import type { Composition, CompositionBlob, Palette } from '../types';

const RADIUS_MIN = 0.2;
const RADIUS_MAX = 0.5;
const MINIS_PER_CLUSTER = 8;
const JITTER_FACTOR = 0.5;       // max distance of a mini from cluster centre at irregularity=1
const RADIUS_VARIATION = 0.6;    // ±60% variation around baseMiniR at irregularity=1
const MINI_R_SCALE = 1 / Math.sqrt(MINIS_PER_CLUSTER);

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
  irregularity: number,
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

    // Each logical blob is a cluster of MINIS_PER_CLUSTER minis. Mini radius is
    // scaled by 1/√N so that N stacked minis at the same point produce the
    // same metaball field as a single blob of radius baseR. This makes
    // irregularity=0 (stacked) visually identical to "1 blob with radius baseR"
    // and removes the old discontinuity at the 0→0+ε transition.
    const baseMiniR = baseR * MINI_R_SCALE;
    const spread = baseR * JITTER_FACTOR * irregularity;
    const radiusVar = RADIUS_VARIATION * irregularity;

    for (let m = 0; m < MINIS_PER_CLUSTER; m++) {
      const jx = (rng() - 0.5) * 2 * spread;
      const jy = (rng() - 0.5) * 2 * spread;
      const miniR = baseMiniR * (1 + (rng() - 0.5) * 2 * radiusVar);
      blobs.push({
        x: cx + jx,
        y: cy + jy,
        radius: miniR,
        variantIdx,
      });
    }
  }
  return { seed, blobs };
}
