import { drawContours } from './contour';
import { applyGrain } from './grain';
import type { RenderParams } from '../types';

// Field-source constants mirror the heatmap renderer so the mesh relief tracks
// exactly the same blob "relief" the heatmap proposes.
const MINI_COUNT = 8;
const MINI_R_SCALE = 1 / Math.sqrt(MINI_COUNT);
const MINI_OFFSET_SCALE = 0.65;

// Contour grid resolution (px between sampled vertices). Finer = smoother lines
// but more work; ~2.5px reads as smooth at preview and export sizes alike.
const CELL_PX = 2.5;

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace('#', '');
  return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
}

function rgbToHex(r: number, g: number, b: number): string {
  const h = (v: number) => Math.round(v).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

// Sample a colour ramp at pos in [0,1], linearly interpolating between stops.
function sampleRamp(colors: string[], pos: number): string {
  const n = colors.length;
  if (n === 1) return colors[0];
  const x = Math.max(0, Math.min(1, pos)) * (n - 1);
  const i = Math.floor(x);
  if (i >= n - 1) return colors[n - 1];
  const f = x - i;
  const [r0, g0, b0] = hexToRgb(colors[i]);
  const [r1, g1, b1] = hexToRgb(colors[i + 1]);
  return rgbToHex(r0 + (r1 - r0) * f, g0 + (g1 - g0) * f, b0 + (b1 - b0) * f);
}

export function renderMesh(target: HTMLCanvasElement, params: RenderParams): void {
  const {
    width, height, palette, composition, irregularity, grain,
    meshLevels, meshLineWidth, meshRelief, meshLineColor, meshColorMode,
  } = params;
  target.width = width;
  target.height = height;
  const ctx = target.getContext('2d')!;

  // 1. Background fill.
  ctx.fillStyle = palette.background;
  ctx.fillRect(0, 0, width, height);

  // 2. Pre-compute blob field sources (identical maths to the heatmap).
  const minDim = Math.min(width, height);
  const offsetScale = MINI_OFFSET_SCALE * irregularity;
  const blobs = composition.blobs.map((b) => {
    const r = b.radius * minDim;
    const miniR = r * MINI_R_SCALE;
    const miniRSq = miniR * miniR;
    const cx = b.x * width;
    const cy = b.y * height;
    const minis = b.harmonics.minis.map((m) => ({
      cx: cx + m.ox * r * offsetScale,
      cy: cy + m.oy * r * offsetScale,
    }));
    return { miniRSq, minis };
  });
  const nBlobs = blobs.length;

  // 3. Sample the blob field on a regular grid.
  const cell = Math.max(1, CELL_PX);
  const cols = Math.floor(width / cell) + 1;
  const rows = Math.floor(height / cell) + 1;
  const blobGrid = new Float32Array(cols * rows);

  let blobMax = 1e-6;
  for (let j = 0; j < rows; j++) {
    const py = j * cell;
    for (let i = 0; i < cols; i++) {
      const px = i * cell;
      let f = 0;
      for (let b = 0; b < nBlobs; b++) {
        const blob = blobs[b];
        const miniRSq = blob.miniRSq;
        const minis = blob.minis;
        for (let m = 0; m < minis.length; m++) {
          const dx = px - minis[m].cx;
          const dy = py - minis[m].cy;
          f += miniRSq / (dx * dx + dy * dy + miniRSq);
        }
      }
      blobGrid[j * cols + i] = f;
      if (f > blobMax) blobMax = f;
    }
  }

  // 4. Height field = a monotonic gamma remap of the normalized blob field.
  //    "Relevo extra" lowers gamma, which stretches the field's low-value tail
  //    so more contour levels land in the gentle falloff around the cluster.
  //    Because the remap is MONOTONIC it never changes the shape of any iso-
  //    contour — the extra lines are concentric echoes that follow exactly the
  //    irregularity and form of the outer blob contours, with no new shapes.
  const gamma = 1 / (1 + meshRelief * 2);
  const field = new Float32Array(cols * rows);
  let hMin = Infinity;
  let hMax = -Infinity;
  for (let k = 0; k < field.length; k++) {
    const h = Math.pow(blobGrid[k] / blobMax, gamma);
    field[k] = h;
    if (h < hMin) hMin = h;
    if (h > hMax) hMax = h;
  }

  // 5. Evenly spaced contour levels across the field's range.
  const span = hMax - hMin || 1;
  const nLevels = Math.max(1, Math.round(meshLevels));
  const levels: number[] = [];
  for (let k = 1; k <= nLevels; k++) {
    levels.push(hMin + (span * k) / (nLevels + 1));
  }

  // 6. Per-level colours. 'solid' uses one ink; 'palette' samples the heatmap
  //    gradient by height (core colour at the peaks → outer colours at the
  //    periphery), so the lines follow the same palette as the heatmap.
  let colors: string[];
  if (meshColorMode === 'palette') {
    const ramp = palette.blobVariants[0].stops
      .filter((s) => s.alpha >= 0.05)
      .map((s) => s.color);
    const safeRamp = ramp.length ? ramp : [meshLineColor];
    colors = levels.map((lv) => sampleRamp(safeRamp, 1 - (lv - hMin) / span));
  } else {
    colors = levels.map(() => meshLineColor);
  }

  // 7. Stroke the contours.
  const lw = Math.max(0.4, meshLineWidth);
  drawContours(ctx, field, cols, rows, cell, cell, levels, colors, lw);

  // 8. Grain overlay (same texture as the heatmap renderer).
  applyGrain(target, grain);
}
