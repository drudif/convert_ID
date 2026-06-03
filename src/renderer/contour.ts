// Marching squares iso-contour extraction. Given a scalar height field sampled
// on a regular grid, it strokes topographic contour lines (one closed family
// per level) — the flat top-down "relief map" look from the reference art.

type Pt = { x: number; y: number };

/**
 * Draw iso-contour lines of `field` (row-major, `cols`×`rows` vertices, spaced
 * `cellW`×`cellH` px) at each height in `levels`. `colors` is parallel to
 * `levels` — each contour is stroked in its own colour.
 *
 * Each grid cell is classified by which of its 4 corners sit above the level;
 * the contour crosses the edges between an above and a below corner, linearly
 * interpolated. Saddle cells (diagonal corners above) are disambiguated by the
 * cell-centre average so lines never cross.
 */
export function drawContours(
  ctx: CanvasRenderingContext2D,
  field: Float32Array,
  cols: number,
  rows: number,
  cellW: number,
  cellH: number,
  levels: number[],
  colors: string[],
  lineWidth: number,
): void {
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  for (let li = 0; li < levels.length; li++) {
    const level = levels[li];
    ctx.strokeStyle = colors[li] ?? colors[colors.length - 1];
    ctx.beginPath();
    for (let j = 0; j < rows - 1; j++) {
      const rowTop = j * cols;
      const rowBot = (j + 1) * cols;
      const y = j * cellH;
      for (let i = 0; i < cols - 1; i++) {
        const tl = field[rowTop + i];
        const tr = field[rowTop + i + 1];
        const br = field[rowBot + i + 1];
        const bl = field[rowBot + i];

        const code =
          (tl > level ? 8 : 0) |
          (tr > level ? 4 : 0) |
          (br > level ? 2 : 0) |
          (bl > level ? 1 : 0);
        if (code === 0 || code === 15) continue;

        const x = i * cellW;
        // Edge crossing points (computed lazily per case).
        const top = (): Pt => ({ x: x + cellW * ((level - tl) / (tr - tl)), y });
        const right = (): Pt => ({ x: x + cellW, y: y + cellH * ((level - tr) / (br - tr)) });
        const bottom = (): Pt => ({ x: x + cellW * ((level - bl) / (br - bl)), y: y + cellH });
        const left = (): Pt => ({ x, y: y + cellH * ((level - tl) / (bl - tl)) });

        switch (code) {
          case 1: case 14: seg(ctx, left(), bottom()); break;
          case 2: case 13: seg(ctx, bottom(), right()); break;
          case 3: case 12: seg(ctx, left(), right()); break;
          case 4: case 11: seg(ctx, top(), right()); break;
          case 6: case 9:  seg(ctx, top(), bottom()); break;
          case 7: case 8:  seg(ctx, top(), left()); break;
          case 5: { // TR & BL above — saddle
            if ((tl + tr + br + bl) * 0.25 > level) {
              seg(ctx, top(), left());
              seg(ctx, bottom(), right());
            } else {
              seg(ctx, top(), right());
              seg(ctx, left(), bottom());
            }
            break;
          }
          case 10: { // TL & BR above — saddle
            if ((tl + tr + br + bl) * 0.25 > level) {
              seg(ctx, top(), right());
              seg(ctx, left(), bottom());
            } else {
              seg(ctx, top(), left());
              seg(ctx, bottom(), right());
            }
            break;
          }
        }
      }
    }
    ctx.stroke();
  }
}

function seg(ctx: CanvasRenderingContext2D, a: Pt, b: Pt): void {
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
}
