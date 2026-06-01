import { applyGrain } from './grain';
import type { GradientStop, RenderParams } from '../types';

const SUBCENTER_OFFSET_SCALE = 0.5; // max satellite offset = 0.5 · baseR · irregularity —
                                    // tight enough that the metaball never loses its neck

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = hex.replace('#', '');
  return {
    r: parseInt(m.slice(0, 2), 16),
    g: parseInt(m.slice(2, 4), 16),
    b: parseInt(m.slice(4, 6), 16),
  };
}

// Kept exported for backward compatibility with existing tests, and as a
// general helper for future palette transforms. Per-band weights subsume
// its role in the heat-map pipeline.
export function applyHardness(stops: GradientStop[], hardness: number): GradientStop[] {
  const factor = 1 - hardness;
  return stops.map((s) => ({ ...s, offset: s.offset * factor }));
}

// Apply per-band weights to a 4-stop gradient. The sliders are normalised
// to their SUM so each one represents its band's share of the LUT [0..1]
// — three symmetric sliders, each behaves the same way. Without
// normalisation the cumulative offsets cap at 1 (because the LUT can't
// extend further) which makes later sliders feel different from Centro.
// Silhouette size is the Fluidez slider's job, not these.
function applyBandWeights(
  stops: GradientStop[],
  centroW: number,
  anel1W: number,
  anel2W: number,
): GradientStop[] {
  if (stops.length !== 4) return stops; // only the standard 4-stop palettes are weighted
  const total = centroW + anel1W + anel2W;
  if (total <= 0) return stops; // degenerate; leave stops untouched
  const c = centroW / total;
  const a1 = anel1W / total;
  return [
    { ...stops[0], offset: 0 },
    { ...stops[1], offset: c },
    { ...stops[2], offset: c + a1 },
    { ...stops[3], offset: 1 },
  ];
}

type GradientLut = {
  r: Uint8ClampedArray;
  g: Uint8ClampedArray;
  b: Uint8ClampedArray;
};

function buildLut(stops: GradientStop[], bg: { r: number; g: number; b: number }): GradientLut {
  const N = 256;
  const r = new Uint8ClampedArray(N);
  const g = new Uint8ClampedArray(N);
  const b = new Uint8ClampedArray(N);
  const rgbStops = stops.map((s) => ({ ...s, ...hexToRgb(s.color) }));

  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    let lo = rgbStops[0];
    let hi = rgbStops[rgbStops.length - 1];
    for (let k = 0; k < rgbStops.length - 1; k++) {
      if (t >= rgbStops[k].offset && t <= rgbStops[k + 1].offset) {
        lo = rgbStops[k];
        hi = rgbStops[k + 1];
        break;
      }
    }
    if (t <= rgbStops[0].offset) { lo = hi = rgbStops[0]; }
    if (t >= rgbStops[rgbStops.length - 1].offset) { lo = hi = rgbStops[rgbStops.length - 1]; }

    const span = hi.offset - lo.offset;
    const f = span > 0 ? (t - lo.offset) / span : 0;
    r[i] = lo.r + (hi.r - lo.r) * f;
    g[i] = lo.g + (hi.g - lo.g) * f;
    b[i] = lo.b + (hi.b - lo.b) * f;
  }

  // If the last stop is a fade marker (α<0.05), fade from the last visible
  // stop's colour to background over the remainder of the LUT — so Dureza-
  // equivalent compression (low band weights) yields a smooth fade band
  // rather than a slab of one colour.
  const lastStop = rgbStops[rgbStops.length - 1];
  if (lastStop.alpha < 0.05) {
    let lastVisible = rgbStops[0];
    for (let i = rgbStops.length - 1; i >= 0; i--) {
      if (rgbStops[i].alpha > 0.05) { lastVisible = rgbStops[i]; break; }
    }
    const cutoff = Math.round(lastVisible.offset * (N - 1));
    const span = (N - 1) - cutoff;
    for (let i = cutoff + 1; i < N; i++) {
      const t = span > 0 ? (i - cutoff) / span : 1;
      r[i] = lastVisible.r * (1 - t) + bg.r * t;
      g[i] = lastVisible.g * (1 - t) + bg.g * t;
      b[i] = lastVisible.b * (1 - t) + bg.b * t;
    }
  }

  return { r, g, b };
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
    grain, blur, irregularity, fluidez,
    centroWeight, anel1Weight, anel2Weight,
  } = params;
  target.width = width;
  target.height = height;
  const targetCtx = target.getContext('2d')!;

  // 1. Background
  const bg = hexToRgb(palette.background);
  targetCtx.fillStyle = palette.background;
  targetCtx.fillRect(0, 0, width, height);

  // 2. Palette LUT. Per-band weights position the 4 stops on the LUT, then
  // the buildLut fade-to-bg extension handles the unused tail (sum < 1).
  const weightedStops = applyBandWeights(
    palette.blobVariants[0].stops,
    centroWeight, anel1Weight, anel2Weight,
  );
  const lut = buildLut(weightedStops, bg);

  // 3. Pre-compute per-blob field params + flattened subcenter coords (in px).
  // Subcenter offsets and radii both scale with irregularity, so at
  // irregularity=0 the satellites have zero radius (no contribution) and the
  // blob is exactly a circle. As irregularity rises, satellites grow into
  // existence and pull the silhouette outward in their offset directions.
  const minDim = Math.min(width, height);
  const offsetScale = SUBCENTER_OFFSET_SCALE * irregularity;
  const blobs = composition.blobs.map((b) => {
    const r = b.radius * minDim;
    const subs: { cx: number; cy: number; rSq: number }[] = [];
    if (irregularity > 0) {
      for (const sub of b.harmonics.subcenters) {
        const subR = r * sub.rf * irregularity;
        subs.push({
          cx: b.x * width + sub.ox * r * offsetScale,
          cy: b.y * height + sub.oy * r * offsetScale,
          rSq: subR * subR,
        });
      }
    }
    return {
      cx: b.x * width,
      cy: b.y * height,
      rSq: r * r,
      subs,
    };
  });

  // 4. Heat-map field mapping (equal-area, γ=1). Fluidez lowers threshold to
  // widen the silhouette and let neighbouring blobs merge into one metaball.
  const threshold = 1.0 - fluidez * 0.85;
  const edgeBand = Math.max(0.02, threshold * 0.08);
  const edgeLo = Math.max(0.001, threshold - edgeBand);
  const edgeHi = threshold + edgeBand;

  // 5. Per-pixel evaluation.
  const img = targetCtx.getImageData(0, 0, width, height);
  const data = img.data;
  const nBlobs = blobs.length;
  const EPS = 0.5;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let totalField = 0;
      for (let i = 0; i < nBlobs; i++) {
        const b = blobs[i];
        // Primary contribution
        const dx = x - b.cx;
        const dy = y - b.cy;
        totalField += b.rSq / (dx * dx + dy * dy + EPS);
        // Satellite contributions add bulges in their offset directions
        for (let s = 0; s < b.subs.length; s++) {
          const sub = b.subs[s];
          const sdx = x - sub.cx;
          const sdy = y - sub.cy;
          totalField += sub.rSq / (sdx * sdx + sdy * sdy + EPS);
        }
      }

      const inside = smoothstep(edgeLo, edgeHi, totalField);
      if (inside <= 0) continue;

      // Equal-area mapping: heatOffset = threshold / totalField.
      let heatOffset = threshold / totalField;
      if (heatOffset > 1) heatOffset = 1;
      const lutIdx = (heatOffset * 255) | 0;

      const a = inside;
      const ia = 1 - a;
      const idx = (y * width + x) << 2;
      data[idx]     = lut.r[lutIdx] * a + bg.r * ia;
      data[idx + 1] = lut.g[lutIdx] * a + bg.g * ia;
      data[idx + 2] = lut.b[lutIdx] * a + bg.b * ia;
      data[idx + 3] = 255;
    }
  }

  targetCtx.putImageData(img, 0, 0);

  // 6. Optional post-blur.
  const scaledBlur = blur * (minDim / 1080);
  if (scaledBlur > 0) {
    const blurred = document.createElement('canvas');
    blurred.width = width;
    blurred.height = height;
    const blurredCtx = blurred.getContext('2d')!;
    blurredCtx.filter = `blur(${scaledBlur}px)`;
    blurredCtx.drawImage(target, 0, 0);
    targetCtx.clearRect(0, 0, width, height);
    targetCtx.drawImage(blurred, 0, 0);
  }

  // 7. Grain overlay
  applyGrain(target, grain);
}
