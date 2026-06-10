import { applyGrain } from './grain';
import { renderMesh } from './mesh';
import { renderAsset } from './asset';
import { makeWarp } from './warp';
import { morphOffset } from './animate';
import { mulberry32 } from '../lib/prng';
import type { GradientStop, RenderParams } from '../types';

// A field source: a cluster of "minis" (their spread = the IRREGULARIDADE / particle
// separation) plus an envelope (1 for permanent composition blobs; 0..1 for transient
// flow/spawns). On top of this, a shared domain WARP (see ./warp) displaces the sample
// coordinate, deforming the silhouette smoothly. The two effects are independent and
// combine. No more "core" copy — every ring samples the same field, so the heatmap and
// mesh stay in register.
type Source = {
  miniRSq: number;
  minis: { cx: number; cy: number }[];
  env: number;
};

const MINI_COUNT = 8;
const MINI_R_SCALE = 1 / Math.sqrt(MINI_COUNT);   // 8 stacked minis with this radius
                                                  // produce the same field as 1 primary R
const MINI_OFFSET_SCALE = 0.65;                   // mini cluster spread at irregularidade=1

// Field threshold range. The Lorentzian field per mini peaks at 1; with 8
// minis per blob and multi-blob compositions, totalField reaches ~5–8 at
// dense cluster cores, ~0.3–1 in cluster outskirts. These bounds give the
// size sliders a useful spatial range.
const FIELD_THR_MAX = 4.5;   // default size=0 → ring barely shows
const FIELD_THR_MIN = 0.06;  // size=1 → ring covers most of the canvas

// Rings 0 and 1 use a higher threshold ceiling so that at slider=0 they can
// shrink to near-invisible — useful for tight hot cores and thin inner rings.
const FIELD_THR_MAX_R0 = 12;
const FIELD_THR_MAX_R1 = 7;

function sizeToThreshold(size: number, thrMax: number = FIELD_THR_MAX): number {
  // Log mapping: equal slider steps correspond to equal multiplicative
  // changes in threshold (and thus exponential changes in spatial extent
  // near the small end).
  return FIELD_THR_MIN * Math.pow(thrMax / FIELD_THR_MIN, 1 - size);
}

const TWO_PI = Math.PI * 2;
const FLOW_SPEED = 0.26;        // drift=1 → this fraction of minDim per second
const FLOW_MEAND_FREQ = 0.8;    // sideways meander frequency along each path
// Flowing blobs deform faster, richer and out of sync with each other — like a
// body squirming through a medium to move, not a flat shape gliding over glass.
const FLOW_MORPH_FREQ = 1.8;
const FLOW_MORPH_GAIN = 0.62;
const SPAWN_FADE = 0.28;        // fraction of a surge's life spent fading in / out
const FLOW_FADE = 0.18;         // fraction of a flow blob's life spent fading

// Smooth fade-in/out envelope over a normalized life u∈[0,1]. `fade` is the
// portion at each end spent ramping. Keeps blobs from popping in/out abruptly.
function fadeEnvelope(u: number, fade: number): number {
  if (u <= 0 || u >= 1) return 0;
  const e = Math.min(u / fade, (1 - u) / fade, 1);
  return e * e * (3 - 2 * e); // smoothstep ease
}

// Continuous, NON-LOOPING liquid flow. Blob `i` is born at `i*interval` somewhere
// in the (extended) frame and travels in its OWN random direction (plus a sideways
// meander) until it leaves the frame, where it's dropped and higher-index blobs
// keep entering. The metaball field fades naturally at the edges, so blobs glide
// in and out with no pop and no loop. Only the blobs alive at `t` are built.
function buildFlowSources(
  time: number, seed: number, density: number, size: number, driftAmt: number,
  width: number, height: number, minDim: number, offsetScale: number, morphAmp: number,
): Source[] {
  if (density <= 0 || driftAmt <= 0 || size <= 0) return [];
  const speed = driftAmt * FLOW_SPEED * minDim;       // px / second
  const margin = size * 1.3 * minDim;                 // off-frame allowance
  const exW = width + 2 * margin;
  const exH = height + 2 * margin;
  const cross = Math.hypot(exW, exH) / speed;         // max relevant age (s)
  // Spawn fast enough to keep ~density blobs visible inside the real frame
  // (spawned across the larger extended frame, so scale by the area ratio).
  const areaRatio = (exW * exH) / (width * height);
  const interval = cross / Math.max(1, density * areaRatio);
  // births ≥ 0 so the stream is empty at t=0 (frame 0 = the PNG) and fades in.
  const iStart = Math.max(0, Math.ceil((time - cross) / interval));
  const iEnd = Math.floor(time / interval);
  const out: Source[] = [];
  for (let i = iStart; i <= iEnd; i++) {
    const age = time - i * interval;
    if (age < 0 || age > cross) continue;
    // Fade in/out over the blob's life so it never pops in at full strength
    // (even when born inside the frame) — smooth materialise & dissolve.
    const env = fadeEnvelope(age / cross, FLOW_FADE);
    if (env <= 0.001) continue;
    const rng = mulberry32((Math.imul(seed | 0, 0x9e3779b1) ^ Math.imul(i, 0x85ebca6b)) >>> 0);
    const sx = -margin + rng() * exW;
    const sy = -margin + rng() * exH;
    const ang = rng() * TWO_PI;                        // random heading per blob
    const dirx = Math.cos(ang);
    const diry = Math.sin(ang);
    const r = size * (0.7 + rng() * 0.6) * minDim;
    const mean = r * 0.9 * Math.sin(age * FLOW_MEAND_FREQ + rng() * TWO_PI);
    const cx = sx + dirx * speed * age - diry * mean;
    const cy = sy + diry * speed * age + dirx * mean;
    const blobPhase = rng() * TWO_PI; // per-blob phase → blobs morph out of sync
    const miniR = r * MINI_R_SCALE;
    const miniRSq = miniR * miniR;
    const minis: { cx: number; cy: number }[] = [];
    for (let m = 0; m < MINI_COUNT; m++) {
      const [mox, moy] = morphOffset(
        rng() * 2 - 1, rng() * 2 - 1, time, morphAmp,
        FLOW_MORPH_FREQ, FLOW_MORPH_GAIN, blobPhase, 1,
      );
      minis.push({ cx: cx + mox * r * offsetScale, cy: cy + moy * r * offsetScale });
    }
    out.push({ miniRSq, minis, env });
  }
  return out;
}

// In-place "surgimento": transient blobs that fade in and out at random spots
// (no travel), layered on top of whatever base field is active. Deterministic
// and non-looping (spawn index grows with time).
function buildSpawnSources(
  time: number, seed: number, rate: number, life: number, size: number, sizeVar: number,
  width: number, height: number, minDim: number, offsetScale: number, morphAmp: number,
): Source[] {
  if (rate <= 0 || life <= 0 || size <= 0) return [];
  const interval = 1 / rate;
  // births ≥ 0 so surgimento is empty at t=0 (frame 0 = the PNG) and fades in.
  const iStart = Math.max(0, Math.ceil((time - life) / interval));
  const iEnd = Math.floor(time / interval);
  const out: Source[] = [];
  for (let i = iStart; i <= iEnd; i++) {
    const age = time - i * interval;
    if (age < 0 || age > life) continue;
    const env = fadeEnvelope(age / life, SPAWN_FADE);
    if (env <= 0.001) continue;
    // Distinct salt from the flow stream so spawn positions don't correlate.
    const rng = mulberry32((Math.imul(seed | 0, 0x2545f491) ^ Math.imul(i, 0x9e3779b1) ^ 0xABCDEF) >>> 0);
    const cx = rng() * width;
    const cy = rng() * height;
    // sizeVar widens the random spread around `size` (0 = all equal).
    const factor = Math.max(0.15, 1 + (rng() * 2 - 1) * sizeVar * 0.6);
    const r = size * factor * minDim;
    const miniR = r * MINI_R_SCALE;
    const miniRSq = miniR * miniR;
    const minis: { cx: number; cy: number }[] = [];
    for (let m = 0; m < MINI_COUNT; m++) {
      const [mox, moy] = morphOffset(rng() * 2 - 1, rng() * 2 - 1, time, morphAmp);
      minis.push({ cx: cx + mox * r * offsetScale, cy: cy + moy * r * offsetScale });
    }
    out.push({ miniRSq, minis, env });
  }
  return out;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = hex.replace('#', '');
  return {
    r: parseInt(m.slice(0, 2), 16),
    g: parseInt(m.slice(2, 4), 16),
    b: parseInt(m.slice(4, 6), 16),
  };
}

// Kept exported for compatibility with existing tests.
export function applyHardness(stops: GradientStop[], hardness: number): GradientStop[] {
  const factor = 1 - hardness;
  return stops.map((s) => ({ ...s, offset: s.offset * factor }));
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  if (x <= edge0) return 0;
  if (x >= edge1) return 1;
  const t = (x - edge0) / (edge1 - edge0);
  return t * t * (3 - 2 * t);
}

export function render(target: HTMLCanvasElement, params: RenderParams): void {
  if (params.mode === 'mesh') {
    renderMesh(target, params);
    return;
  }
  if (params.mode === 'asset') {
    renderAsset(target, params);
    return;
  }
  const {
    width, height, palette, composition,
    grain, irregularity, warp: warpAmt, warpScale, time, morphAmp,
    drift, flowDensity, flowSize,
    spawnRate, spawnLife, spawnSize, spawnSizeVar,
    ring0Weight, ring0Fluidez,
    ring1Weight, ring1Fluidez,
    ring2Weight, ring2Fluidez,
    ring3Weight, ring3Fluidez,
    ring4Weight, ring4Fluidez,
    bordaWeight, bordaFluidez,
    deletedRings,
  } = params;
  // Deleted inner rings (colorIdx 1..5 → ring0..ring4): their presence is forced
  // to 0 so the outer neighbour fills the gap with no fringe/"ghost".
  const d0 = deletedRings.includes(1);
  const d1 = deletedRings.includes(2);
  const d2 = deletedRings.includes(3);
  const d3 = deletedRings.includes(4);
  const d4 = deletedRings.includes(5);
  target.width = width;
  target.height = height;
  const targetCtx = target.getContext('2d')!;

  // 1. Background
  const bg = hexToRgb(palette.background);
  targetCtx.fillStyle = palette.background;
  targetCtx.fillRect(0, 0, width, height);

  // 2. Resolve effective sizes with nesting clamps. Each inner ring is
  //    capped at the size of the next outer ring. Borda = silhouette;
  //    ring 0 = innermost hot core (sits on top of every other layer).
  const effB = bordaWeight;
  const eff4 = Math.min(ring4Weight, effB);
  const eff3 = Math.min(ring3Weight, eff4);
  const eff2 = Math.min(ring2Weight, eff3);
  const eff1 = Math.min(ring1Weight, eff2);
  const eff0 = Math.min(ring0Weight, eff1);

  // 3. Pre-compute per-blob field params (needed before thresholds so we can
  //    measure the actual peak field of this composition).
  const minDim = Math.min(width, height);
  const offsetScale = MINI_OFFSET_SCALE * irregularity;
  // Shared domain warp on the sample coordinate (amplitude = warpAmt, size =
  // warpScale, evolution speed = morphAmp). Identical to the mesh's warp, so the
  // two modes register exactly. Works ON TOP OF the per-blob mini spread.
  const warp = makeWarp(composition.seed, warpAmt, warpScale, time, minDim);
  // Base layer = the designed composition (the PNG). At time 0 it sits exactly
  // at its designed positions, so the animation STARTS FROM THE PNG. When the
  // correnteza (drift) is on, each composition blob then drifts along its own
  // heading and leaves the frame — handed off to the flow stream and surgimento,
  // which start empty at t=0 and fade in to sustain the scene.
  const flowSpeed = drift * FLOW_SPEED * minDim;
  const base: Source[] = composition.blobs.map((b, i) => {
    const r = b.radius * minDim;
    const miniR = r * MINI_R_SCALE;
    const miniRSq = miniR * miniR;
    let cx = b.x * width;
    let cy = b.y * height;
    if (drift > 0) {
      const rng = mulberry32((Math.imul(composition.seed | 0, 0x9e3779b1) ^ Math.imul(i + 1, 0x85ebca6b)) >>> 0);
      const ang = rng() * TWO_PI;
      cx += Math.cos(ang) * flowSpeed * time;
      cy += Math.sin(ang) * flowSpeed * time;
    }
    const minis: { cx: number; cy: number }[] = [];
    for (const m of b.harmonics.minis) {
      const [mox, moy] = morphOffset(m.ox, m.oy, time, morphAmp);
      minis.push({ cx: cx + mox * r * offsetScale, cy: cy + moy * r * offsetScale });
    }
    return { miniRSq, minis, env: 1 };
  });
  // Stream (sustains the flow as the composition drifts off) + in-place
  // surgimento. Both start empty at t=0 (births ≥ 0) so frame 0 is purely the PNG.
  const sources = base
    .concat(buildFlowSources(time, composition.seed, flowDensity, flowSize, drift,
      width, height, minDim, offsetScale, morphAmp))
    .concat(buildSpawnSources(time, composition.seed, spawnRate, spawnLife, spawnSize, spawnSizeVar,
      width, height, minDim, offsetScale, morphAmp));
  const nSources = sources.length;

  // Metaball field (sum over each source's mini cluster) sampled at a WARPED
  // coordinate. The mini spread = irregularidade; the coordinate warp = warp.
  const fieldAt = (x: number, y: number): number => {
    const [wx, wy] = warp(x, y);
    const sx = x + wx;
    const sy = y + wy;
    let f = 0;
    for (let i = 0; i < nSources; i++) {
      const b = sources[i];
      const miniRSq = b.miniRSq;
      const env = b.env;
      const minis = b.minis;
      for (let m = 0; m < minis.length; m++) {
        const dx = sx - minis[m].cx;
        const dy = sy - minis[m].cy;
        f += env * (miniRSq / (dx * dx + dy * dy + miniRSq));
      }
    }
    return f;
  };

  // 4. Estimate the peak field on a coarse grid. The metaball field maxes out
  //    around blob/cluster cores, but its exact peak depends on blob count,
  //    radius and irregularity. A fixed threshold ceiling (e.g. 12 for ring 0)
  //    can exceed that peak, so the innermost rings vanish entirely at low
  //    sizes instead of shrinking to a tiny visible core. Clamping each
  //    threshold to a fraction of the measured peak keeps every ring present.
  let fieldMax = 0;
  const sampleStep = Math.max(1, Math.floor(minDim / 96));
  for (let y = 0; y < height; y += sampleStep) {
    for (let x = 0; x < width; x += sampleStep) {
      const f = fieldAt(x, y);
      if (f > fieldMax) fieldMax = f;
    }
  }
  // Coarse sampling slightly undershoots the true peak, so VISIBLE_FRACTION
  // can sit close to 1 and still guarantee a few real pixels clear the
  // threshold — a minimal but always-present core at size 0.
  const thrCeil = fieldMax * 0.95;

  // 5. Per-ring field thresholds (size → outer threshold of that ring).
  //    Higher size = lower threshold = bigger spatial coverage. Rings 0 and 1
  //    use a steeper mapping so they can shrink to near-invisible at slider=0.
  //    Each is capped at thrCeil so it can never exceed the achievable field.
  const thr0 = Math.min(sizeToThreshold(eff0, FIELD_THR_MAX_R0), thrCeil);
  const thr1 = Math.min(sizeToThreshold(eff1, FIELD_THR_MAX_R1), thrCeil);
  const thr2 = Math.min(sizeToThreshold(eff2), thrCeil);
  const thr3 = Math.min(sizeToThreshold(eff3), thrCeil);
  const thr4 = Math.min(sizeToThreshold(eff4), thrCeil);
  const thrB = Math.min(sizeToThreshold(effB), thrCeil);

  // 6. Per-ring boundary blur widths (smoothstep band, scales with the
  //    ring's threshold so the blur is meaningful at both small and large
  //    rings). A small floor ensures even fluidez=0 has a sub-pixel soft edge.
  const band0 = Math.max(0.005, ring0Fluidez * thr0 * 1.2);
  const band1 = Math.max(0.005, ring1Fluidez * thr1 * 1.2);
  const band2 = Math.max(0.005, ring2Fluidez * thr2 * 1.2);
  const band3 = Math.max(0.005, ring3Fluidez * thr3 * 1.2);
  const band4 = Math.max(0.005, ring4Fluidez * thr4 * 1.2);
  const bandB = Math.max(0.005, bordaFluidez * thrB * 1.2);

  // 5. Palette colours. Six stops map to six rings (º0 innermost → Borda
  //    outermost). If the Borda stop has alpha < 0.05 it's a "fade marker"
  //    (preset palette convention) — Borda then uses the bg colour, so
  //    the outermost layer becomes invisible but still controls silhouette
  //    extent via borda sliders.
  const variant = palette.blobVariants[0];
  const c0 = hexToRgb(variant.stops[0].color);
  const c1 = hexToRgb(variant.stops[1].color);
  const c2 = hexToRgb(variant.stops[2].color);
  const c3 = hexToRgb(variant.stops[3].color);
  const c4 = hexToRgb(variant.stops[4].color);
  const cB = variant.stops[5].alpha < 0.05
    ? bg
    : hexToRgb(variant.stops[5].color);

  // 8. Per-pixel evaluation. For each pixel compute the metaball field,
  //    then three smoothstep "presence" values — one per ring — and
  //    composite the ring colours onto the bg in order Anel 2 → Anel 1 →
  //    Centro. Each ring's boundary smoothness is the corresponding
  //    fluidez (independent blur per ring).
  const img = targetCtx.getImageData(0, 0, width, height);
  const data = img.data;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Same warped single-source field that the mesh samples — so every ring,
      // º0 included, lands on exactly the same iso-contours as the mesh.
      const totalField = fieldAt(x, y);

      // Borda presence is the silhouette alpha (outermost ring).
      const bB = smoothstep(thrB - bandB, thrB + bandB, totalField);
      if (bB <= 0) continue;

      const b4 = d4 ? 0 : smoothstep(thr4 - band4, thr4 + band4, totalField);
      const b3 = d3 ? 0 : smoothstep(thr3 - band3, thr3 + band3, totalField);
      const b2 = d2 ? 0 : smoothstep(thr2 - band2, thr2 + band2, totalField);
      const b1 = d1 ? 0 : smoothstep(thr1 - band1, thr1 + band1, totalField);
      const b0 = d0 ? 0 : smoothstep(thr0 - band0, thr0 + band0, totalField);

      // Layered blend: bg → Borda → º4 → º3 → º2 → º1 → º0 (innermost on top)
      let r = bg.r * (1 - bB) + cB.r * bB;
      let g = bg.g * (1 - bB) + cB.g * bB;
      let bl = bg.b * (1 - bB) + cB.b * bB;
      r = r * (1 - b4) + c4.r * b4;
      g = g * (1 - b4) + c4.g * b4;
      bl = bl * (1 - b4) + c4.b * b4;
      r = r * (1 - b3) + c3.r * b3;
      g = g * (1 - b3) + c3.g * b3;
      bl = bl * (1 - b3) + c3.b * b3;
      r = r * (1 - b2) + c2.r * b2;
      g = g * (1 - b2) + c2.g * b2;
      bl = bl * (1 - b2) + c2.b * b2;
      r = r * (1 - b1) + c1.r * b1;
      g = g * (1 - b1) + c1.g * b1;
      bl = bl * (1 - b1) + c1.b * b1;
      r = r * (1 - b0) + c0.r * b0;
      g = g * (1 - b0) + c0.g * b0;
      bl = bl * (1 - b0) + c0.b * b0;

      const idx = (y * width + x) << 2;
      data[idx]     = r;
      data[idx + 1] = g;
      data[idx + 2] = bl;
      data[idx + 3] = 255;
    }
  }

  targetCtx.putImageData(img, 0, 0);

  // 8. Grain overlay
  applyGrain(target, grain);
}
