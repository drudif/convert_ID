import { applyGrain } from './grain';
import type { GradientStop, RenderParams } from '../types';

const MINI_COUNT = 8;
const MINI_R_SCALE = 1 / Math.sqrt(MINI_COUNT);   // 8 stacked minis with this radius
                                                  // produce the same field as 1 primary R
const MINI_OFFSET_SCALE = 0.65;                   // mini cluster spread at irregularity=1

// Field threshold range. The Lorentzian field per mini peaks at 1; with 8
// minis per blob and multi-blob compositions, totalField reaches ~5–8 at
// dense cluster cores, ~0.3–1 in cluster outskirts. These bounds give the
// size sliders a useful spatial range.
const FIELD_THR_MAX = 4.5;   // size=0 → very small ring
const FIELD_THR_MIN = 0.06;  // size=1 → ring covers most of the canvas

function sizeToThreshold(size: number): number {
  // Log-ish mapping: small slider changes near 0 produce big size changes
  // (small thresholds compress the bottom of the range visually).
  return FIELD_THR_MIN * Math.pow(FIELD_THR_MAX / FIELD_THR_MIN, 1 - size);
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
  const {
    width, height, palette, composition,
    grain, irregularity,
    ring1Weight, ring1Fluidez,
    ring2Weight, ring2Fluidez,
    ring3Weight, ring3Fluidez,
    ring4Weight, ring4Fluidez,
  } = params;
  target.width = width;
  target.height = height;
  const targetCtx = target.getContext('2d')!;

  // 1. Background
  const bg = hexToRgb(palette.background);
  targetCtx.fillStyle = palette.background;
  targetCtx.fillRect(0, 0, width, height);

  // 2. Resolve effective sizes with nesting clamps. Each inner ring is
  //    capped at the size of the next outer ring (rendered ring 1 can't
  //    exceed ring 2's size, etc.). Ring 4 is the silhouette extent.
  const eff4 = ring4Weight;
  const eff3 = Math.min(ring3Weight, eff4);
  const eff2 = Math.min(ring2Weight, eff3);
  const eff1 = Math.min(ring1Weight, eff2);

  // 3. Per-ring field thresholds (size → outer threshold of that ring).
  //    Higher size = lower threshold = bigger spatial coverage.
  const thr1 = sizeToThreshold(eff1);
  const thr2 = sizeToThreshold(eff2);
  const thr3 = sizeToThreshold(eff3);
  const thr4 = sizeToThreshold(eff4);

  // 4. Per-ring boundary blur widths (smoothstep band, scales with the
  //    ring's threshold so the blur is meaningful at both small and large
  //    rings). A small floor ensures even fluidez=0 has a sub-pixel soft edge.
  const band1 = Math.max(0.005, ring1Fluidez * thr1 * 1.2);
  const band2 = Math.max(0.005, ring2Fluidez * thr2 * 1.2);
  const band3 = Math.max(0.005, ring3Fluidez * thr3 * 1.2);
  const band4 = Math.max(0.005, ring4Fluidez * thr4 * 1.2);

  // 5. Palette colours. Four stops map to four rings (º1 innermost → º4
  //    outermost). If the 4th stop has alpha < 0.05 it's a "fade marker"
  //    (preset palette convention) — in that case ring 4 uses the bg
  //    colour, so the layer becomes invisible but still controls silhouette
  //    extent via ring4 sliders.
  const variant = palette.blobVariants[0];
  const c1 = hexToRgb(variant.stops[0].color);
  const c2 = hexToRgb(variant.stops[1].color);
  const c3 = hexToRgb(variant.stops[2].color);
  const c4 = variant.stops[3].alpha < 0.05
    ? bg
    : hexToRgb(variant.stops[3].color);

  // 6. Pre-compute per-blob field params.
  const minDim = Math.min(width, height);
  const offsetScale = MINI_OFFSET_SCALE * irregularity;
  const blobs = composition.blobs.map((b) => {
    const r = b.radius * minDim;
    const miniR = r * MINI_R_SCALE;
    const miniRSq = miniR * miniR;
    const cx = b.x * width;
    const cy = b.y * height;
    const minis: { cx: number; cy: number }[] = [];
    for (const m of b.harmonics.minis) {
      minis.push({
        cx: cx + m.ox * r * offsetScale,
        cy: cy + m.oy * r * offsetScale,
      });
    }
    return { miniRSq, minis };
  });

  // 7. Per-pixel evaluation. For each pixel compute the metaball field,
  //    then three smoothstep "presence" values — one per ring — and
  //    composite the ring colours onto the bg in order Anel 2 → Anel 1 →
  //    Centro. Each ring's boundary smoothness is the corresponding
  //    fluidez (independent blur per ring).
  const img = targetCtx.getImageData(0, 0, width, height);
  const data = img.data;
  const nBlobs = blobs.length;

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

      // Ring 4 presence is also the silhouette alpha (outermost ring).
      const b4 = smoothstep(thr4 - band4, thr4 + band4, totalField);
      if (b4 <= 0) continue;

      const b3 = smoothstep(thr3 - band3, thr3 + band3, totalField);
      const b2 = smoothstep(thr2 - band2, thr2 + band2, totalField);
      const b1 = smoothstep(thr1 - band1, thr1 + band1, totalField);

      // Layered blend: bg → º4 → º3 → º2 → º1 (innermost wins on top)
      let r = bg.r * (1 - b4) + c4.r * b4;
      let g = bg.g * (1 - b4) + c4.g * b4;
      let bl = bg.b * (1 - b4) + c4.b * b4;
      r = r * (1 - b3) + c3.r * b3;
      g = g * (1 - b3) + c3.g * b3;
      bl = bl * (1 - b3) + c3.b * b3;
      r = r * (1 - b2) + c2.r * b2;
      g = g * (1 - b2) + c2.g * b2;
      bl = bl * (1 - b2) + c2.b * b2;
      r = r * (1 - b1) + c1.r * b1;
      g = g * (1 - b1) + c1.g * b1;
      bl = bl * (1 - b1) + c1.b * b1;

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
