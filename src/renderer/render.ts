import { applyGrain } from './grain';
import { renderMesh } from './mesh';
import type { GradientStop, RenderParams } from '../types';

const MINI_COUNT = 8;
const MINI_R_SCALE = 1 / Math.sqrt(MINI_COUNT);   // 8 stacked minis with this radius
                                                  // produce the same field as 1 primary R
const MINI_OFFSET_SCALE = 0.65;                   // mini cluster spread at irregularity=1

// º0 (the hot core) renders from a LESS-spread copy of the mini cluster, so its
// field peak stays high as irregularity rises — the core keeps its irregular
// distortion but no longer dilutes (fades/fragments) or grows. The other rings
// still use the fully-spread field. 0 = core ignores irregularity (round core);
// 1 = core spreads like everything else (the old, diluting behaviour).
const RING0_SPREAD = 0.45;

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
  const {
    width, height, palette, composition,
    grain, irregularity,
    ring0Weight, ring0Fluidez,
    ring1Weight, ring1Fluidez,
    ring2Weight, ring2Fluidez,
    ring3Weight, ring3Fluidez,
    ring4Weight, ring4Fluidez,
    bordaWeight, bordaFluidez,
  } = params;
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
  const blobs = composition.blobs.map((b) => {
    const r = b.radius * minDim;
    const miniR = r * MINI_R_SCALE;
    const miniRSq = miniR * miniR;
    const cx = b.x * width;
    const cy = b.y * height;
    const minis: { cx: number; cy: number }[] = [];
    const coreMinis: { cx: number; cy: number }[] = [];
    for (const m of b.harmonics.minis) {
      const ox = m.ox * r * offsetScale;
      const oy = m.oy * r * offsetScale;
      minis.push({ cx: cx + ox, cy: cy + oy });
      coreMinis.push({ cx: cx + ox * RING0_SPREAD, cy: cy + oy * RING0_SPREAD });
    }
    return { miniRSq, minis, coreMinis };
  });
  const nBlobs = blobs.length;

  // 4. Estimate the peak field on a coarse grid. The metaball field maxes out
  //    around blob/cluster cores, but its exact peak depends on blob count,
  //    radius and irregularity. A fixed threshold ceiling (e.g. 12 for ring 0)
  //    can exceed that peak, so the innermost rings vanish entirely at low
  //    sizes instead of shrinking to a tiny visible core. Clamping each
  //    threshold to a fraction of the measured peak keeps every ring present.
  let fieldMax = 0;
  let coreFieldMax = 0;
  const sampleStep = Math.max(1, Math.floor(minDim / 96));
  for (let y = 0; y < height; y += sampleStep) {
    for (let x = 0; x < width; x += sampleStep) {
      let f = 0;
      let cf = 0;
      for (let i = 0; i < nBlobs; i++) {
        const b = blobs[i];
        const miniRSq = b.miniRSq;
        for (let m = 0; m < b.minis.length; m++) {
          const mini = b.minis[m];
          const dx = x - mini.cx;
          const dy = y - mini.cy;
          f += miniRSq / (dx * dx + dy * dy + miniRSq);
          const cm = b.coreMinis[m];
          const cdx = x - cm.cx;
          const cdy = y - cm.cy;
          cf += miniRSq / (cdx * cdx + cdy * cdy + miniRSq);
        }
      }
      if (f > fieldMax) fieldMax = f;
      if (cf > coreFieldMax) coreFieldMax = cf;
    }
  }
  // Coarse sampling slightly undershoots the true peak, so VISIBLE_FRACTION
  // can sit close to 1 and still guarantee a few real pixels clear the
  // threshold — a minimal but always-present core at size 0.
  const thrCeil = fieldMax * 0.95;
  const coreThrCeil = coreFieldMax * 0.95;

  // 5. Per-ring field thresholds (size → outer threshold of that ring).
  //    Higher size = lower threshold = bigger spatial coverage. Rings 0 and 1
  //    use a steeper mapping so they can shrink to near-invisible at slider=0.
  //    Each is capped at thrCeil so it can never exceed the achievable field.
  const thr0 = Math.min(sizeToThreshold(eff0, FIELD_THR_MAX_R0), coreThrCeil);
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
      let totalField = 0;
      for (let i = 0; i < nBlobs; i++) {
        const b = blobs[i];
        const miniRSq = b.miniRSq;
        for (let m = 0; m < b.minis.length; m++) {
          const mini = b.minis[m];
          const dx = x - mini.cx;
          const dy = y - mini.cy;
          totalField += miniRSq / (dx * dx + dy * dy + miniRSq);
        }
      }

      // Borda presence is the silhouette alpha (outermost ring).
      const bB = smoothstep(thrB - bandB, thrB + bandB, totalField);
      if (bB <= 0) continue;

      const b4 = smoothstep(thr4 - band4, thr4 + band4, totalField);
      const b3 = smoothstep(thr3 - band3, thr3 + band3, totalField);
      const b2 = smoothstep(thr2 - band2, thr2 + band2, totalField);
      const b1 = smoothstep(thr1 - band1, thr1 + band1, totalField);

      // º0 uses the less-spread core field so it stays compact and bright as
      // irregularity rises, instead of diluting with the fully-spread field.
      let coreField = 0;
      for (let i = 0; i < nBlobs; i++) {
        const b = blobs[i];
        const miniRSq = b.miniRSq;
        for (let m = 0; m < b.coreMinis.length; m++) {
          const cm = b.coreMinis[m];
          const dx = x - cm.cx;
          const dy = y - cm.cy;
          coreField += miniRSq / (dx * dx + dy * dy + miniRSq);
        }
      }
      const b0 = smoothstep(thr0 - band0, thr0 + band0, coreField);

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
