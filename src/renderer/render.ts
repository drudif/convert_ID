import { applyGrain } from './grain';
import type { BlobStops, CompositionBlob, GradientStop, RenderParams } from '../types';

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

export function applyHardness(stops: GradientStop[], hardness: number): GradientStop[] {
  const factor = 1 - hardness;
  return stops.map((s) => ({ ...s, offset: s.offset * factor }));
}

function drawBlob(
  ctx: CanvasRenderingContext2D,
  blob: CompositionBlob,
  variant: BlobStops,
  width: number,
  height: number,
  hardness: number,
): void {
  const minDim = Math.min(width, height);
  const cx = blob.x * width;
  const cy = blob.y * height;
  const r = blob.radius * minDim;

  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  const transformedStops = applyHardness(variant.stops, hardness);
  for (const stop of transformedStops) {
    grad.addColorStop(stop.offset, rgba(stop.color, stop.alpha));
  }
  ctx.fillStyle = grad;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
}

export function render(target: HTMLCanvasElement, params: RenderParams): void {
  const { width, height, palette, composition, grain, blur, fluidez } = params;
  target.width = width;
  target.height = height;

  const targetCtx = target.getContext('2d')!;

  // 1. Background
  targetCtx.fillStyle = palette.background;
  targetCtx.fillRect(0, 0, width, height);

  // 2. Render blobs with full color gradients (source-over keeps palette colors true).
  const blobLayer = document.createElement('canvas');
  blobLayer.width = width;
  blobLayer.height = height;
  const blobCtx = blobLayer.getContext('2d')!;

  for (const blob of composition.blobs) {
    const variant = palette.blobVariants[blob.variantIdx];
    drawBlob(blobCtx, blob, variant, width, height, params.hardness);
  }

  // 3. Composite blurred colors clipped by a contrast-enhanced alpha mask.
  // Two passes on the same blobLayer:
  //   3a — blur only, copies smoothly-blended colors onto scratch (no RGB distortion);
  //   3b — blur + contrast with destination-in, where only the source ALPHA matters,
  //        so contrast shapes the metaball silhouette without touching colors.
  const minDim = Math.min(width, height);
  const scaledBlur = blur * (minDim / 1080);
  const contrastFactor = 1 + fluidez * 24;

  const scratch = document.createElement('canvas');
  scratch.width = width;
  scratch.height = height;
  const scratchCtx = scratch.getContext('2d')!;

  // 3a: blurred colors — no contrast, hues preserved
  scratchCtx.filter = scaledBlur > 0 ? `blur(${scaledBlur}px)` : 'none';
  scratchCtx.drawImage(blobLayer, 0, 0);

  // 3b: metaball mask via destination-in (only the alpha of the source affects the mask)
  if (fluidez > 0) {
    const maskFilter = scaledBlur > 0
      ? `blur(${scaledBlur}px) contrast(${contrastFactor})`
      : `contrast(${contrastFactor})`;
    scratchCtx.filter = maskFilter;
    scratchCtx.globalCompositeOperation = 'destination-in';
    scratchCtx.drawImage(blobLayer, 0, 0);
    scratchCtx.globalCompositeOperation = 'source-over';
  }
  scratchCtx.filter = 'none';

  // 4. Composite onto target
  targetCtx.drawImage(scratch, 0, 0);

  // 5. Grain overlay
  applyGrain(target, grain);
}
