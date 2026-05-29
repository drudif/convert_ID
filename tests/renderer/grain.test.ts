import { describe, it, expect, beforeEach } from 'vitest';
import { getNoiseTile, applyGrain, _resetCache } from '../../src/renderer/grain';

beforeEach(() => {
  _resetCache();
});

describe('getNoiseTile', () => {
  it('returns the same tile across calls (cached)', () => {
    const a = getNoiseTile();
    const b = getNoiseTile();
    expect(a).toBe(b);
  });

  it('returns a 512x512 canvas', () => {
    const tile = getNoiseTile();
    expect(tile.width).toBe(512);
    expect(tile.height).toBe(512);
  });
});

describe('applyGrain', () => {
  it('does not throw for valid inputs', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 200;
    expect(() => applyGrain(canvas, 0.5)).not.toThrow();
  });

  it('does not throw for intensity 0 or 1', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    expect(() => applyGrain(canvas, 0)).not.toThrow();
    expect(() => applyGrain(canvas, 1)).not.toThrow();
  });
});
