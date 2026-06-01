import { mulberry32 } from '../lib/prng';
import type { Composition, CompositionBlob, Palette } from '../types';

const RADIUS_MIN = 0.2;
const RADIUS_MAX = 0.5;
const OUTLINE_ANCHORS = 16; // perimeter samples; renderer smoothstep-interpolates between them

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

    // 16 random anchors around the perimeter. The renderer uses smoothstep
    // interpolation between them, producing an asymmetric organic outline
    // with no rotational symmetry — unlike sin(kθ) harmonics which always
    // give k equal lobes ("floral" look the user wants to avoid).
    const anchors: number[] = [];
    for (let i = 0; i < OUTLINE_ANCHORS; i++) {
      anchors.push(rng() * 2 - 1);
    }
    const harmonics = { anchors };

    blobs.push({ x: cx, y: cy, radius: baseR, variantIdx, harmonics });
  }
  return { seed, blobs };
}
