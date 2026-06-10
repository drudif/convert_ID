import { mulberry32 } from '../lib/prng';
import type { Composition, CompositionBlob, Palette } from '../types';

// Blob radius as a fraction of min(width, height). Kept deliberately small so
// blobs read as discrete shapes on the background — even a handful (e.g. 4)
// don't tile over and fully cover the canvas. Defaults; overridable per call.
export const RADIUS_MIN = 0.12;
export const RADIUS_MAX = 0.28;
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
  // Tamanho dos blobs (fração de min(w,h)). sizeVar in [0,1] controla quanto o
  // raio se espalha DENTRO do range: 1 = uniforme em [min,max]; 0 = todos no
  // meio do range; valores intermediários ficam mais perto do meio.
  sizeMin: number = RADIUS_MIN,
  sizeMax: number = RADIUS_MAX,
  sizeVar: number = 1,
  // Orientação dos blobs no canvas: âncora (0..1) p/ onde eles tendem. Centro =
  // (0.5, 0.5); direita ↑x; abaixo ↑y. SPREAD mantém aleatoriedade ao redor dela.
  anchorX: number = 0.5,
  anchorY: number = 0.5,
  // free = aleatório total no canvas inteiro (ignora a âncora), como antes do
  // recurso de posição.
  free: boolean = false,
): Composition {
  const rng = mulberry32(seed);
  const weights =
    palette.variantWeights ?? palette.blobVariants.map(() => 1);

  const lo = Math.min(sizeMin, sizeMax);
  const hi = Math.max(sizeMin, sizeMax);
  const mid = (lo + hi) / 2;
  const half = ((hi - lo) / 2) * Math.max(0, Math.min(1, sizeVar));

  // Dispersão aleatória em torno da âncora, GRADUADA pelo tamanho do blob:
  // blob menor → menos variação de posição em relação à âncora (não fica agressivo
  // quando o raio cai abaixo de ~0.10). Proporcional ao raio, com piso e teto.
  const SPREAD = 0.3;       // dispersão p/ blobs de tamanho "cheio"
  const SPREAD_REF = 0.2;   // raio a partir do qual a dispersão é total
  const SPREAD_MIN = 0.15;  // fração mínima (blobs minúsculos mantêm um respiro)
  const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

  const blobs: CompositionBlob[] = [];
  for (let i = 0; i < blobCount; i++) {
    const baseR = mid + (rng() * 2 - 1) * half;
    let cx: number;
    let cy: number;
    if (free) {
      cx = rng();
      cy = rng();
    } else {
      const spread = SPREAD * Math.max(SPREAD_MIN, Math.min(1, baseR / SPREAD_REF));
      cx = clamp01(anchorX + (rng() * 2 - 1) * spread);
      cy = clamp01(anchorY + (rng() * 2 - 1) * spread);
    }
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
