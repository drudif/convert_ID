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

// Build a 256-entry color/alpha lookup table from gradient stops so the
// per-pixel hot loop only does array access (no string parsing, no branching).
type GradientLut = {
  r: Uint8ClampedArray;
  g: Uint8ClampedArray;
  b: Uint8ClampedArray;
  a: Float32Array;
};

function buildLut(stops: GradientStop[]): GradientLut {
  const N = 256;
  const r = new Uint8ClampedArray(N);
  const g = new Uint8ClampedArray(N);
  const b = new Uint8ClampedArray(N);
  const a = new Float32Array(N);
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
    a[i] = lo.alpha + (hi.alpha - lo.alpha) * f;
  }

  // Extend the last *visible* color across the rest of the LUT.
  // Palettes typically end with alpha=0 ("borda") which is the natural
  // soft-falloff edge for v1-style rendering — but in metaball mode the
  // silhouette comes from the field, so we need the colour to persist
  // beyond the nominal blob radius rather than vanish to black.
  let lastVisibleIdx = 0;
  for (let i = N - 1; i >= 0; i--) {
    if (a[i] > 0.05) { lastVisibleIdx = i; break; }
  }
  const extR = r[lastVisibleIdx];
  const extG = g[lastVisibleIdx];
  const extB = b[lastVisibleIdx];
  for (let i = lastVisibleIdx + 1; i < N; i++) {
    r[i] = extR;
    g[i] = extG;
    b[i] = extB;
    // a[i] kept as-is (already faded near 0); silhouette alpha takes over
  }
  return { r, g, b, a };
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

  // 2. Pre-compute per-blob data (positions in px, radius², gradient LUT)
  const minDim = Math.min(width, height);
  const blobs = composition.blobs.map((b) => {
    const variant = palette.blobVariants[b.variantIdx];
    const r = b.radius * minDim;
    return {
      cx: b.x * width,
      cy: b.y * height,
      r,
      rSq: r * r,
      invR: 1 / r,
      lut: buildLut(applyHardness(variant.stops, hardness)),
    };
  });

  // 3. Metaball field threshold and edge softness driven by fluidez.
  // Each blob contributes f = r²/d² (classic inverse-square field).
  // A single blob has f = 1 at d = r (its nominal edge).
  // Lower threshold → silhouette extends further → blobs merge over wider gaps.
  // Edge band: tight at fluidez=0 (near-binary outline) → wide at fluidez=1
  // (soft oil-drop falloff).
  const threshold = 1.0 - fluidez * 0.85;             // [0.15, 1.0]
  const edgeBand = Math.max(0.03, fluidez * 0.6);     // [0.03, 0.6]
  const edgeLo = Math.max(0.001, threshold - edgeBand);
  const edgeHi = threshold + edgeBand;

  // 4. Per-pixel metaball evaluation. Silhouette comes entirely from the field;
  // colour is field-weighted gradient sample (LUT alpha is unused — it would
  // re-introduce the "invisible beyond nominal radius" problem the LUT extension
  // above is meant to fix).
  const img = targetCtx.getImageData(0, 0, width, height);
  const data = img.data;
  const nBlobs = blobs.length;
  const EPS = 0.5;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let totalField = 0;
      let wR = 0;
      let wG = 0;
      let wB = 0;

      for (let i = 0; i < nBlobs; i++) {
        const b = blobs[i];
        const dx = x - b.cx;
        const dy = y - b.cy;
        const d2 = dx * dx + dy * dy + EPS;
        const f = b.rSq / d2;
        totalField += f;

        const d = Math.sqrt(d2);
        const ratio = d * b.invR;
        const lutIdx = ratio >= 1 ? 255 : (ratio * 255) | 0;
        wR += b.lut.r[lutIdx] * f;
        wG += b.lut.g[lutIdx] * f;
        wB += b.lut.b[lutIdx] * f;
      }

      const inside = smoothstep(edgeLo, edgeHi, totalField);
      if (inside <= 0) continue;

      const inv = 1 / totalField;
      const cR = wR * inv;
      const cG = wG * inv;
      const cB = wB * inv;

      // Final alpha = silhouette only. Composite over background.
      const a = inside;
      const ia = 1 - a;
      const idx = (y * width + x) << 2;
      data[idx]     = cR * a + bg.r * ia;
      data[idx + 1] = cG * a + bg.g * ia;
      data[idx + 2] = cB * a + bg.b * ia;
      data[idx + 3] = 255;
    }
  }

  targetCtx.putImageData(img, 0, 0);

  // 5. Optional post-blur (user's slider) for additional softening / depth.
  // No longer load-bearing for the merge — the field math already produced it.
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

  // 6. Grain overlay
  applyGrain(target, grain);
}
