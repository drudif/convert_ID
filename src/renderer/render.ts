import { applyGrain } from './grain';
import type { BlobStops, CompositionBlob, RenderParams } from '../types';

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = hex.replace('#', '');
  return {
    r: parseInt(m.slice(0, 2), 16),
    g: parseInt(m.slice(2, 4), 16),
    b: parseInt(m.slice(4, 6), 16),
  };
}

function rgba(color: string, alpha: number): string {
  const { r, g, b } = hexToRgb(color);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function drawBlob(
  ctx: CanvasRenderingContext2D,
  blob: CompositionBlob,
  variant: BlobStops,
  width: number,
  height: number,
): void {
  const minDim = Math.min(width, height);
  const cx = blob.x * width;
  const cy = blob.y * height;
  const r = blob.radius * minDim;

  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  for (const stop of variant.stops) {
    grad.addColorStop(stop.offset, rgba(stop.color, stop.alpha));
  }
  ctx.fillStyle = grad;
  // Fill a square that bounds the gradient (cheaper than fillRect of whole canvas)
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
}

export function render(target: HTMLCanvasElement, params: RenderParams): void {
  const { width, height, palette, composition, grain, blur } = params;
  target.width = width;
  target.height = height;

  const targetCtx = target.getContext('2d')!;

  // 1. Background
  targetCtx.fillStyle = palette.background;
  targetCtx.fillRect(0, 0, width, height);

  // 2. Blob layer on offscreen canvas with additive blending
  const offscreen = document.createElement('canvas');
  offscreen.width = width;
  offscreen.height = height;
  const offCtx = offscreen.getContext('2d')!;
  offCtx.globalCompositeOperation = 'lighter';

  for (const blob of composition.blobs) {
    const variant = palette.blobVariants[blob.variantIdx];
    drawBlob(offCtx, blob, variant, width, height);
  }

  // 3. Blit offscreen onto target with one blur pass
  const minDim = Math.min(width, height);
  const scaledBlur = blur * (minDim / 1080);
  targetCtx.save();
  targetCtx.filter = scaledBlur > 0 ? `blur(${scaledBlur}px)` : 'none';
  targetCtx.drawImage(offscreen, 0, 0);
  targetCtx.restore();

  // 4. Grain overlay
  applyGrain(target, grain);
}
