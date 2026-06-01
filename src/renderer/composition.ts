import { mulberry32 } from '../lib/prng';
import type { Composition, CompositionBlob, Palette } from '../types';

const RADIUS_MIN = 0.2;
const RADIUS_MAX = 0.5;
const MINI_COUNT = 8; // identical field sources per blob — the cluster's centroid is
                      // the only visible peak even when they spread out at high
                      // irregularity, so no fragment can read as a separate hot dot

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

    // Eight identical mini sources that stack at the blob centre when
    // irregularity=0 (field equivalent to one primary R), then drift apart
    // within a tight cloud as irregularity rises. Same radius across all
    // minis means no dominant peak — the cluster reads as one unified blob.
    const minis = [];
    for (let i = 0; i < MINI_COUNT; i++) {
      minis.push({
        ox: rng() * 2 - 1,
        oy: rng() * 2 - 1,
      });
    }
    const harmonics = { minis };

    blobs.push({ x: cx, y: cy, radius: baseR, variantIdx, harmonics });
  }
  return { seed, blobs };
}
