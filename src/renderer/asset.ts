import { mulberry32 } from '../lib/prng';
import type { RenderParams } from '../types';

// ASSET mode — a standalone generator. ONE centred organic blob, FULLY banded
// (concentric quantised colour bands) from the core colour (º0) at the centre out
// to the Borda at a near-circular edge, on a TRANSPARENT background, 1:1. The
// central colour gets a large presence → a bigger central mass whose diffusion is
// itself in bands (matching the reference), not a smooth gradient.
//
// Shape: a near-circular outer silhouette (edgeB) with an angular deformation that
// is strongest around the CORE and fades to zero at the centre and at the edge, so
// the core is the most irregular part while the outer rim reads as an irregular
// circle. Inherits only the palette (+ seed for variation).

const TWO_PI = Math.PI * 2;
const ASSET_RADIUS = 0.42;        // outer radius as a fraction of the square side
const NH = 5;                     // angular harmonics of the organic deformation
const EDGE_IRREG = 0.05;          // how non-circular the outer silhouette is (small)
const DEF_BASE = 0.35;            // base radial-band displacement scale (× Distorção)
const ASSET_CENTER_JITTER = 0.05; // seeded position jitter of the whole shape (fraction of side)
const CORE_JITTER = 0.22;         // seeded offset of the CORE within the blob (× Rmax) — the
                                  // bands emanate from here, so they readjust asymmetrically
const WARP_SPEED = 0.3;           // temporal drift of the deformation (animates on play)
const BUMP_NORM = 27 / 4;         // 1 / max(t·(1-t)²) so the bump peaks at 1
const NTH = 4;                    // harmonics of the per-band thickness micro-variation
const THICK_AMP = 0.02;           // amount of band-thickness "breathing" along each band

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace('#', '');
  return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
}

function smoothstep(e0: number, e1: number, x: number): number {
  if (x <= e0) return 0;
  if (x >= e1) return 1;
  const t = (x - e0) / (e1 - e0);
  return t * t * (3 - 2 * t);
}

export function renderAsset(target: HTMLCanvasElement, params: RenderParams): void {
  const { width, height, palette, composition, time, assetBands, assetWarp, assetCore, assetPresence, deletedRings } = params;
  target.width = width;
  target.height = height;
  const ctx = target.getContext('2d')!;
  ctx.clearRect(0, 0, width, height); // transparent background

  const S = Math.min(width, height);

  // Colours CORE → EDGE: the ACTIVE inner stops (º0…º4 minus any deleted ring),
  // then the Borda (or the bg if the Borda stop is a fade marker). A deleted ring
  // drops out entirely — colour AND its presence — so the rest redistribute.
  const stops = palette.blobVariants[0].stops;
  const bordaCol = stops[5].alpha < 0.05 ? palette.background : stops[5].color;
  const presence = assetPresence.length === 6 ? assetPresence : [1.25, 1, 1, 1, 1, 1];
  const activeIdx: number[] = [];
  for (let i = 0; i <= 4; i++) if (!deletedRings.includes(i + 1)) activeIdx.push(i);
  activeIdx.push(5); // Borda is never deleted
  const C: [number, number, number][] = activeIdx.map((i) => hexToRgb(i === 5 ? bordaCol : stops[i].color));
  const W = activeIdx.map((i) => Math.max(0, presence[i]));
  const n = C.length;

  // Per-colour presence → cumulative radial boundaries B[0..n] (0 centre → 1 edge).
  let total = 0;
  for (let i = 0; i < n; i++) total += W[i];
  if (total <= 0) total = 1;
  const B = [0];
  for (let i = 0; i < n; i++) B.push(B[i] + W[i] / total);
  B[n] = 1;
  // Colour at radial position t (0 centre → 1 edge): interpolate within its band.
  const colorAt = (t: number): [number, number, number] => {
    for (let i = 0; i < n; i++) {
      if (t < B[i + 1] || i === n - 1) {
        const span = B[i + 1] - B[i] || 1;
        const localT = Math.max(0, Math.min(1, (t - B[i]) / span));
        const a = C[i];
        const b = C[Math.min(i + 1, n - 1)];
        return [a[0] + (b[0] - a[0]) * localT, a[1] + (b[1] - a[1]) * localT, a[2] + (b[2] - a[2]) * localT];
      }
    }
    return C[n - 1];
  };

  const bands = Math.max(2, Math.round(assetBands));
  const rng = mulberry32(((composition.seed | 0) ^ 0x9e3779b1) >>> 0);
  const Rmax = ASSET_RADIUS * S;
  // Silhouette centre (overall position) and, offset from it, the CORE centre the
  // bands radiate from — its seeded displacement reshuffles the bands each gen.
  const shapeCx = width / 2 + (rng() * 2 - 1) * ASSET_CENTER_JITTER * S;
  const shapeCy = height / 2 + (rng() * 2 - 1) * ASSET_CENTER_JITTER * S;
  const coreAng = rng() * TWO_PI;
  const coreDist = rng() * CORE_JITTER * Rmax;
  const ox = Math.cos(coreAng) * coreDist; // core − shape offset
  const oy = Math.sin(coreAng) * coreDist;
  const coreCx = shapeCx + ox;
  const coreCy = shapeCy + oy;
  const mSq = ox * ox + oy * oy;

  // Organic angular deformation: a few seeded harmonics, normalised to ~[-1,1].
  const hAmp: number[] = [];
  const hPhase: number[] = [];
  const hSpin: number[] = [];
  let norm = 0;
  for (let k = 1; k <= NH; k++) {
    const a = 1 / k;
    hAmp.push(a);
    norm += a;
    hPhase.push(rng() * TWO_PI);
    hSpin.push(rng() * 2 - 1);
  }
  const invNorm = 1 / norm;
  const defAmt = assetWarp * DEF_BASE;

  // Per-band thickness micro-variation: a higher-frequency angular field whose
  // phase DRIFTS with the radius (thRad), so bands at different radii get slightly
  // different angular displacement → each band's thickness breathes along it.
  const thHar: number[] = [];
  const thRad: number[] = [];
  const thPhase: number[] = [];
  const thAmp: number[] = [];
  const thSpin: number[] = [];
  let thNorm = 0;
  for (let k = 0; k < NTH; k++) {
    const a = 1 / (k + 1);
    thAmp.push(a);
    thNorm += a;
    thHar.push(2 + k);            // angular lobes 2..5
    thRad.push(1.5 + rng() * 2);  // radial cycles across the radius
    thPhase.push(rng() * TWO_PI);
    thSpin.push(rng() * 2 - 1);
  }
  const invThNorm = 1 / thNorm;

  // Band geometry: the first (pure central) band is `core`× wider than the rest.
  const core = Math.max(1, assetCore);
  const w0 = core / (core + bands - 1);
  const colorForBand = (k: number): [number, number, number] => {
    const kk = k < 0 ? 0 : k > bands - 1 ? bands - 1 : k;
    return colorAt(kk / bands);
  };

  const img = ctx.getImageData(0, 0, width, height);
  const data = img.data;
  const reject = Rmax * (1 + EDGE_IRREG) + coreDist + 1; // quick-reject radius from core
  for (let y = 0; y < height; y++) {
    const dyC = y - coreCy;
    for (let x = 0; x < width; x++) {
      const dxC = x - coreCx;
      const dCore = Math.sqrt(dxC * dxC + dyC * dyC);
      if (dCore >= reject) continue; // far outside → transparent

      const th = Math.atan2(dyC, dxC); // angle measured from the (offset) core centre
      let def = 0;
      for (let k = 0; k < NH; k++) {
        def += hAmp[k] * Math.sin((k + 1) * th + hPhase[k] + time * hSpin[k] * WARP_SPEED);
      }
      def *= invNorm; // ~[-1,1]

      // Silhouette = a near-circular boundary (radius R) around the SHAPE centre.
      // Distance from the offset core centre to that boundary along this ray =
      // ray↔circle intersection. t then runs 0 (core centre) → 1 (silhouette), so
      // the bands fill the gap and bunch up where the core sits near the edge.
      const R = Rmax * (1 + EDGE_IRREG * def);
      let s: number;
      if (dCore < 1e-6) {
        s = R - Math.sqrt(mSq);
      } else {
        const inv = 1 / dCore;
        const bb = (dxC * ox + dyC * oy) * inv; // û · (core − shape)
        const disc = bb * bb - (mSq - R * R);
        s = -bb + Math.sqrt(disc > 0 ? disc : 0);
      }
      if (s <= 0) continue;
      const t = dCore / s; // 0 core centre → 1 silhouette
      if (t >= 1) continue; // outside → transparent

      // Radial-band displacement peaks around the CORE and vanishes at the centre
      // (stable) and at the edge (circular), so the core is the most irregular part.
      const bump = t * (1 - t) * (1 - t) * BUMP_NORM;
      // Subtle per-band thickness breathing (phase drifts with the radius).
      let thick = 0;
      for (let k = 0; k < NTH; k++) {
        thick += thAmp[k] * Math.sin(thHar[k] * th + thPhase[k] + t * thRad[k] * TWO_PI + time * thSpin[k] * WARP_SPEED);
      }
      thick *= invThNorm;
      let tEff = t + defAmt * def * bump + THICK_AMP * thick * (4 * t * (1 - t));
      if (tEff < 0) tEff = 0;
      else if (tEff > 1) tEff = 1;

      // Continuous band coordinate (core = band 0, spanning a wider radius).
      let bandFloat: number;
      let slope: number; // d(bandFloat)/d(tEff) — for the per-pixel AA width
      if (tEff < w0) {
        bandFloat = tEff / w0;                 // 0..1, the single wide core band
        slope = 1 / w0;
      } else {
        bandFloat = 1 + ((tEff - w0) / (1 - w0)) * (bands - 1); // 1..bands
        slope = (bands - 1) / (1 - w0);
      }
      let bi = Math.floor(bandFloat);
      if (bi > bands - 1) bi = bands - 1;
      const frac = bandFloat - bi;

      // Anti-alias the band edges: blend toward the neighbouring band over ~1px,
      // reaching 50/50 exactly on the boundary. Keeps crisp bands without jaggies.
      let r: number;
      let g: number;
      let b: number;
      const col = colorForBand(bi);
      // d(tEff)/d(pixel) ≈ 1/s along this ray → ~1px AA in band-coordinate units.
      const aaW = Math.min(0.49, (slope / s) * 0.75);
      if (frac > 1 - aaW && bi < bands - 1) {
        const w = (frac - (1 - aaW)) / (2 * aaW);
        const nb = colorForBand(bi + 1);
        r = col[0] + (nb[0] - col[0]) * w;
        g = col[1] + (nb[1] - col[1]) * w;
        b = col[2] + (nb[2] - col[2]) * w;
      } else if (frac < aaW && bi > 0) {
        const w = (aaW - frac) / (2 * aaW);
        const nb = colorForBand(bi - 1);
        r = col[0] + (nb[0] - col[0]) * w;
        g = col[1] + (nb[1] - col[1]) * w;
        b = col[2] + (nb[2] - col[2]) * w;
      } else {
        r = col[0];
        g = col[1];
        b = col[2];
      }
      const alpha = smoothstep(0, 1.5, s - dCore); // fade over ~1.5px at the silhouette
      const idx = (y * width + x) << 2;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = Math.round(alpha * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
}
