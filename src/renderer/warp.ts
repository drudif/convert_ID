import { mulberry32 } from '../lib/prng';

// Shared domain-warp field. Both the heatmap and the mesh sample the metaball
// field at WARPED coordinates — field(x + W(x,y), y + W(x,y)) — so a blob's whole
// silhouette bends coherently into an organic shape instead of fragmenting into
// separate point sources. Because both renderers use the SAME warp over the SAME
// single-source field, every ring (including the innermost º0) stays in register
// between modes.
//
// irregularity = deformation amplitude. morphAmp = how fast the deformation
// evolves over time (the shape "morph"). Deterministic from the composition seed.

const TWO_PI = Math.PI * 2;
const OCT = 3;            // octaves of the warp field (low → high frequency)
const FREQ_MULT = 1.9;    // frequency growth per octave
const GAIN = 0.4;         // amplitude falloff per octave (low = high octaves stay subtle)
const WARP_AMP = 0.16;    // max displacement as a fraction of minDim at warp=1.
const WARP_SPEED = 0.5;   // temporal evolution rate — the warp flows on its own while
                          // playing (time advances), independent of the Morph slider.

// `scale` (0..1) sets the size/length of the deformations: it maps to the base
// spatial frequency. scale=1 → long, sweeping bends (low freq); scale=0 → tighter,
// shorter undulations (higher freq). Endpoints chosen to stay smooth (never the
// edge-eroding high frequencies of the first draft).
const BASE_CYCLES_LONG = 0.35;  // scale = 1 (longest)
const BASE_CYCLES_SHORT = 2.2;  // scale = 0 (shortest)

export type WarpField = (x: number, y: number) => [number, number];

const IDENTITY: WarpField = () => [0, 0];

type Oct = {
  f: number; a: number;
  dcx: number; dsx: number; // wave direction (cos/sin) for the x-displacement
  dcy: number; dsy: number; // wave direction (cos/sin) for the y-displacement
  px: number; py: number;   // spatial phase
  tx: number; ty: number;   // temporal speed
};

export function makeWarp(
  seed: number,
  warp: number,   // amplitude
  scale: number,  // 0..1 deformation size/radius
  time: number,   // animation clock (0 at pause/PNG) — drives the warp's own flow
  minDim: number,
): WarpField {
  if (warp <= 0 || minDim <= 0) return IDENTITY;
  const rng = mulberry32(((seed | 0) ^ 0x5bd1e995) >>> 0);
  const ampPx = warp * WARP_AMP * minDim;
  const s = Math.max(0, Math.min(1, scale));
  const BASE_CYCLES = BASE_CYCLES_SHORT + (BASE_CYCLES_LONG - BASE_CYCLES_SHORT) * s;
  const t = time * WARP_SPEED;

  // Normalize so the summed octave amplitude equals ampPx (no tearing).
  let norm = 0;
  for (let o = 0; o < OCT; o++) norm += Math.pow(GAIN, o);

  const oct: Oct[] = [];
  for (let o = 0; o < OCT; o++) {
    const f = ((BASE_CYCLES * Math.pow(FREQ_MULT, o)) / minDim) * TWO_PI;
    const a = (ampPx * Math.pow(GAIN, o)) / norm;
    const ax = rng() * TWO_PI;
    const ay = rng() * TWO_PI;
    oct.push({
      f, a,
      dcx: Math.cos(ax), dsx: Math.sin(ax),
      dcy: Math.cos(ay), dsy: Math.sin(ay),
      px: rng() * TWO_PI, py: rng() * TWO_PI,
      tx: rng() * 2 - 1, ty: rng() * 2 - 1,
    });
  }

  return (x, y) => {
    let dx = 0;
    let dy = 0;
    for (let o = 0; o < oct.length; o++) {
      const k = oct[o];
      dx += k.a * Math.sin(k.f * (x * k.dcx + y * k.dsx) + k.px + t * k.tx);
      dy += k.a * Math.sin(k.f * (x * k.dcy + y * k.dsy) + k.py + t * k.ty);
    }
    return [dx, dy];
  };
}
