import { mulberry32 } from '../lib/prng';
import type { Composition, CompositionBlob, Palette } from '../types';

const RADIUS_MIN = 0.2;
const RADIUS_MAX = 0.5;
const MINIS_PER_CLUSTER = 8;
const JITTER_FACTOR = 1.0;
const MINI_RADIUS_MIN_FACTOR = 0.5;
const MINI_RADIUS_VARIATION = 0.6;

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

    if (irregularity === 0) {
      blobs.push({ x: cx, y: cy, radius: baseR, variantIdx });
      continue;
    }

    const spread = baseR * JITTER_FACTOR * irregularity;
    for (let m = 0; m < MINIS_PER_CLUSTER; m++) {
      const jx = (rng() - 0.5) * 2 * spread;
      const jy = (rng() - 0.5) * 2 * spread;
      const miniR = baseR * (MINI_RADIUS_MIN_FACTOR + rng() * MINI_RADIUS_VARIATION);
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
