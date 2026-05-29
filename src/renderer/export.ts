import { render } from './render';
import type { RenderParams } from '../types';

export function exportFilename(
  paletteId: string,
  seed: number,
  width: number,
  height: number,
): string {
  return `auragen-${paletteId}-${seed}-${width}x${height}.png`;
}

export async function exportPNG(params: RenderParams): Promise<void> {
  const canvas = document.createElement('canvas');
  try {
    render(canvas, params);
  } catch (err) {
    console.error('Export render failed', err);
    throw new Error('Failed to export — try a smaller resolution.');
  }

  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob(resolve, 'image/png'),
  );
  if (!blob) throw new Error('Failed to export — try a smaller resolution.');

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = exportFilename(
    params.palette.id,
    params.composition.seed,
    params.width,
    params.height,
  );
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
