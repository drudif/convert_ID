import { describe, it, expect } from 'vitest';
import { drawContours } from '../../src/renderer/contour';

// Minimal CanvasRenderingContext2D stub that records path operations so we can
// assert the marching-squares pass actually emits line segments.
function fakeCtx() {
  const ops = { moveTo: 0, lineTo: 0, stroke: 0 };
  return {
    ctx: {
      strokeStyle: '',
      lineWidth: 0,
      lineJoin: '',
      lineCap: '',
      beginPath() {},
      moveTo() { ops.moveTo++; },
      lineTo() { ops.lineTo++; },
      stroke() { ops.stroke++; },
    } as unknown as CanvasRenderingContext2D,
    ops,
  };
}

describe('drawContours', () => {
  it('emits segments for a diagonal ramp field crossed by a level', () => {
    // 4×4 grid, value = i + j (ranges 0..6). A level at 3 must be crossed.
    const cols = 4;
    const rows = 4;
    const field = new Float32Array(cols * rows);
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) field[j * cols + i] = i + j;

    const { ctx, ops } = fakeCtx();
    drawContours(ctx, field, cols, rows, 10, 10, [3], ['#fff'], 1);

    expect(ops.stroke).toBe(1);
    expect(ops.lineTo).toBeGreaterThan(0);
    expect(ops.moveTo).toBe(ops.lineTo); // each segment is one moveTo + one lineTo
  });

  it('emits nothing when the level is outside the field range', () => {
    const cols = 3;
    const rows = 3;
    const field = new Float32Array(cols * rows).fill(1);
    const { ctx, ops } = fakeCtx();
    drawContours(ctx, field, cols, rows, 10, 10, [5], ['#fff'], 1);
    expect(ops.lineTo).toBe(0);
  });
});
