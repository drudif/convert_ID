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
    centroFluidez, anel1Fluidez, anel2Fluidez,
    centroWeight, anel1Weight, anel2Weight,
  } = params;
  target.width = width;
  target.height = height;
  const targetCtx = target.getContext('2d')!;

  // 1. Background
  const bg = hexToRgb(palette.background);
  targetCtx.fillStyle = palette.background;
  targetCtx.fillRect(0, 0, width, height);

  // 2. Resolve effective sizes with nesting clamps:
  //    centro is limited (capped) by anel1; anel1 by anel2; anel2 unconstrained.
  //    The slider value represents desired size; the rendered ring can't be
  //    larger than the next ring out.
  const effA2 = anel2Weight;
  const effA1 = Math.min(anel1Weight, effA2);
  const effC = Math.min(centroWeight, effA1);

  // 3. Per-ring field thresholds (size → outer threshold of that ring).
  //    Higher size = lower threshold = bigger spatial coverage.
  const centroThr = sizeToThreshold(effC);
  const anel1Thr = sizeToThreshold(effA1);
  const anel2Thr = sizeToThreshold(effA2);

  // 4. Per-ring boundary blur (smoothstep band width).
  //    The width scales with fluidez and with the threshold itself, so the
  //    blur is meaningful at both small and large rings. A small constant
  //    is always present so even fluidez=0 has a 1px-ish soft edge.
  const centroBand = Math.max(0.005, centroFluidez * centroThr * 1.2);
  const anel1Band = Math.max(0.005, anel1Fluidez * anel1Thr * 1.2);
  const anel2Band = Math.max(0.005, anel2Fluidez * anel2Thr * 1.2);

  // 5. Palette colours. Layered rendering: bg → Anel 2 → Anel 1 → Centro.
  //    Stops 0..2 are the visible ring colours; stop 3 (Borda) is unused
  //    in this model.
  const variant = palette.blobVariants[0];
  const cColor = hexToRgb(variant.stops[0].color);
  const a1Color = hexToRgb(variant.stops[1].color);
  const a2Color = hexToRgb(variant.stops[2].color);

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

      // Anel 2 presence is also the silhouette alpha.
      const a2b = smoothstep(anel2Thr - anel2Band, anel2Thr + anel2Band, totalField);
      if (a2b <= 0) continue;

      const a1b = smoothstep(anel1Thr - anel1Band, anel1Thr + anel1Band, totalField);
      const cb = smoothstep(centroThr - centroBand, centroThr + centroBand, totalField);

      // Layered blend: bg → Anel 2 → Anel 1 → Centro
      let r = bg.r * (1 - a2b) + a2Color.r * a2b;
      let g = bg.g * (1 - a2b) + a2Color.g * a2b;
      let bl = bg.b * (1 - a2b) + a2Color.b * a2b;
      r = r * (1 - a1b) + a1Color.r * a1b;
      g = g * (1 - a1b) + a1Color.g * a1b;
      bl = bl * (1 - a1b) + a1Color.b * a1b;
      r = r * (1 - cb) + cColor.r * cb;
      g = g * (1 - cb) + cColor.g * cb;
      bl = bl * (1 - cb) + cColor.b * cb;

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
