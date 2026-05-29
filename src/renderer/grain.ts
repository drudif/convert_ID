const TILE_SIZE = 512;

let cachedTile: HTMLCanvasElement | null = null;

export function getNoiseTile(): HTMLCanvasElement {
  if (cachedTile) return cachedTile;

  const canvas = document.createElement('canvas');
  canvas.width = TILE_SIZE;
  canvas.height = TILE_SIZE;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(TILE_SIZE, TILE_SIZE);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(Math.random() * 256);
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
      ctx.drawImage(tile, x, y);
    }
  }
  ctx.restore();
}

// Test-only: reset the cached tile between tests
export function _resetCache(): void {
  cachedTile = null;
}
