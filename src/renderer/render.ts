import { applyGrain } from './grain';
import type { GradientStop, RenderParams } from '../types';

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = hex.replace('#', '');
  return {
    r: parseInt(m.slice(0, 2), 16),
    g: parseInt(m.slice(2, 4), 16),
    b: parseInt(m.slice(4, 6), 16),
  };
}

export function applyHardness(stops: GradientStop[], hardness: number): GradientStop[] {
  const factor = 1 - hardness;
  return stops.map((s) => ({ ...s, offset: s.offset * factor }));
}

// 256-entry colour LUT built from gradient stops. Indexed by heat offset
// (0 = hottest / Centro, 255 = coldest / silhouette edge).
type GradientLut = {
  r: Uint8ClampedArray;
  g: Uint8ClampedArray;
  b: Uint8ClampedArray;
};

function buildLut(stops: GradientStop[]): GradientLut {
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

  // Stops with alpha=0 are meant as "fade to bg" markers (v1 semantic) — their
  // RGB shouldn't drive the silhouette edge colour. Find the last STOP with
  // alpha > 0.05 and replace any LUT entries past that stop's offset with its
  // exact colour, so the edge of the metaball reads as that stop, not an
  // interpolated near-transparent value.
  let lastVisible = rgbStops[0];
  for (let i = rgbStops.length - 1; i >= 0; i--) {
    if (rgbStops[i].alpha > 0.05) { lastVisible = rgbStops[i]; break; }
  }
  const cutoff = Math.round(lastVisible.offset * (N - 1));
  for (let i = cutoff + 1; i < N; i++) {
    r[i] = lastVisible.r;
    g[i] = lastVisible.g;
    b[i] = lastVisible.b;
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
  const { width, height, palette, composition, grain, blur, hardness, fluidez } = params;
  target.width = width;
  target.height = height;
  const targetCtx = target.getContext('2d')!;

  // 1. Background
  const bg = hexToRgb(palette.background);
  targetCtx.fillStyle = palette.background;
  targetCtx.fillRect(0, 0, width, height);

  // 2. Single palette LUT — colour comes from total field intensity, not from
  // distance to any individual blob, so the whole image reads as one heat map.
  // (Multi-variant palettes use variant 0; per-blob variants are a v1 concept
  // that doesn't translate to heat-map mode.)
  const lut = buildLut(applyHardness(palette.blobVariants[0].stops, hardness));

  // 3. Pre-compute per-blob field params (just position and r² — no per-blob LUT).
  const minDim = Math.min(width, height);
  const blobs = composition.blobs.map((b) => {
    const r = b.radius * minDim;
    return { cx: b.x * width, cy: b.y * height, rSq: r * r };
  });

  // 4. Heat-map mapping driven by fluidez.
  // Each blob contributes f = r²/d² (classic inverse-square metaball field).
  // The silhouette is where Σf > threshold; INSIDE the silhouette, the gradient
  // offset is field-to-offset mapped (high field → Centro, low field → edge stop).
  //   - low fluidez → high threshold, tight silhouette, hot core concentrated
  //   - high fluidez → low threshold, wide silhouette merging adjacent blobs,
  //     stretched colour gradient throughout the metaball
  const threshold = 1.0 - fluidez * 0.85;            // [0.15, 1.0]
  const edgeBand = Math.max(0.02, threshold * 0.08); // small — silhouette stays clean
  const edgeLo = Math.max(0.001, threshold - edgeBand);
  const edgeHi = threshold + edgeBand;
  const peakField = threshold * 6;                   // field where heat saturates to Centro
  const heatRange = peakField - threshold;

  // 5. Per-pixel evaluation. Inner loop has no sqrt and no LUT lookup per blob;
  // a single LUT sample happens once per visible pixel.
  const img = targetCtx.getImageData(0, 0, width, height);
  const data = img.data;
  const nBlobs = blobs.length;
  const EPS = 0.5;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let totalField = 0;
      for (let i = 0; i < nBlobs; i++) {
        const b = blobs[i];
        const dx = x - b.cx;
        const dy = y - b.cy;
        totalField += b.rSq / (dx * dx + dy * dy + EPS);
      }

      const inside = smoothstep(edgeLo, edgeHi, totalField);
      if (inside <= 0) continue;

      // Field → heat offset (linear; clamped). Higher field = hotter = lower offset.
      let heatOffset = 1 - (totalField - threshold) / heatRange;
      if (heatOffset < 0) heatOffset = 0;
      else if (heatOffset > 1) heatOffset = 1;
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

  // 6. Optional post-blur (user's slider) — softens the edge, not load-bearing.
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
