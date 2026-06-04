import { mulberry32 } from '../lib/prng';

const TILE_SIZE = 512;
const TILE_SEED = 0x6e6f6973; // deterministic noise → identical on every thread/worker

type TileCanvas = HTMLCanvasElement | OffscreenCanvas;

let cachedTile: TileCanvas | null = null;

// Worker-safe canvas creation: use the DOM canvas on the main thread (and in
// tests), fall back to OffscreenCanvas inside Web Workers where `document`
// doesn't exist.
function makeTileCanvas(): TileCanvas {
  if (typeof document !== 'undefined' && document.createElement) {
    const c = document.createElement('canvas');
    c.width = TILE_SIZE;
    c.height = TILE_SIZE;
    return c;
  }
  return new OffscreenCanvas(TILE_SIZE, TILE_SIZE);
}

export function getNoiseTile(): TileCanvas {
  if (cachedTile) return cachedTile;

  const canvas = makeTileCanvas();
  const ctx = (canvas as HTMLCanvasElement).getContext('2d') as CanvasRenderingContext2D;
  const img = ctx.createImageData(TILE_SIZE, TILE_SIZE);
  // Seeded (not Math.random) so the noise is the SAME on the main thread and in
  // every export worker — consistent grain across frames, reproducible output.
  const rng = mulberry32(TILE_SEED);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(rng() * 256);
    img.data[i]     = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);

  cachedTile = canvas;
  return canvas;
}

export function applyGrain(target: HTMLCanvasElement, intensity: number): void {
  if (intensity <= 0) return;
  const ctx = target.getContext('2d')!;
  const tile = getNoiseTile();

  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = intensity;
  for (let y = 0; y < target.height; y += TILE_SIZE) {
    for (let x = 0; x < target.width; x += TILE_SIZE) {
      ctx.drawImage(tile as CanvasImageSource, x, y);
    }
  }
  ctx.restore();
}

// Test-only: reset the cached tile between tests
export function _resetCache(): void {
  cachedTile = null;
}
