import { mulberry32 } from '../lib/prng';
import type { Composition, CompositionBlob, Palette } from '../types';

const RADIUS_MIN = 0.2;
const RADIUS_MAX = 0.5;
const TWO_PI = Math.PI * 2;
const HARMONIC_COUNT = 5; // k = 3..7; k=2 deliberately skipped (it's an ellipse)

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

    // Pick ONE dominant harmonic per blob (gives the silhouette a definite
    // lobe count — 3 = triangle, 5 = starfish, 6 = flower, etc). The other
    // harmonics get small random amps so the lobes aren't perfectly
    // symmetric. Without a dominant, summing 5 mid-amp sines just smooths
    // out to a soft wavy ellipse.
    const dominantIdx = Math.floor(rng() * HARMONIC_COUNT);
    const amps: number[] = [];
    const phases: number[] = [];
    for (let h = 0; h < HARMONIC_COUNT; h++) {
      const sign = rng() > 0.5 ? 1 : -1;
      const mag = rng();
      if (h === dominantIdx) {
        amps.push(sign * (0.7 + mag * 0.3));   // |amp| in [0.7, 1.0]
      } else {
        amps.push(sign * mag * 0.3);            // |amp| in [0, 0.3]
      }
      phases.push(rng() * TWO_PI);
    }
    const harmonics = { amps, phases };

    blobs.push({ x: cx, y: cy, radius: baseR, variantIdx, harmonics });
  }
  return { seed, blobs };
}
