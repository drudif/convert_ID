import { mulberry32 } from '../lib/prng';
import type { Composition, CompositionBlob, Palette } from '../types';

const RADIUS_MIN = 0.2;
const RADIUS_MAX = 0.5;
const TWO_PI = Math.PI * 2;

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

    // Three angular harmonics define a fixed organic outline signature for
    // this blob. The render pipeline multiplies the per-pixel perturbation
    // by the runtime irregularity value, so the slider smoothly takes the
    // same blob from a perfect circle to its full distorted silhouette
    // without changing topology (still one connected metaball).
    const harmonics = {
      amps: [
        rng() * 2 - 1,
        rng() * 2 - 1,
        rng() * 2 - 1,
      ] as [number, number, number],
      phases: [
        rng() * TWO_PI,
        rng() * TWO_PI,
        rng() * TWO_PI,
      ] as [number, number, number],
    };

    blobs.push({ x: cx, y: cy, radius: baseR, variantIdx, harmonics });
  }
  return { seed, blobs };
}
