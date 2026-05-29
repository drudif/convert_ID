import { describe, it, expect } from 'vitest';
import { applyHardness } from '../../src/renderer/render';
import type { GradientStop } from '../../src/types';

const sampleStops: GradientStop[] = [
  { offset: 0,    color: '#ff7a4d', alpha: 1.0 },
  { offset: 0.35, color: '#ec4899', alpha: 0.9 },
  { offset: 0.65, color: '#6b46c1', alpha: 0.5 },
  { offset: 1,    color: '#000000', alpha: 0   },
];

describe('applyHardness', () => {
  it('hardness=0 returns identical offsets', () => {
    const result = applyHardness(sampleStops, 0);
    expect(result.map((s) => s.offset)).toEqual([0, 0.35, 0.65, 1]);
  });

  it('hardness=0.5 halves all offsets', () => {
    const result = applyHardness(sampleStops, 0.5);
    expect(result[0].offset).toBeCloseTo(0);
    expect(result[1].offset).toBeCloseTo(0.175);
    expect(result[2].offset).toBeCloseTo(0.325);
    expect(result[3].offset).toBeCloseTo(0.5);
  });

  it('preserves color and alpha (only offsets change)', () => {
    const result = applyHardness(sampleStops, 0.7);
    for (let i = 0; i < sampleStops.length; i++) {
      expect(result[i].color).toBe(sampleStops[i].color);
      expect(result[i].alpha).toBe(sampleStops[i].alpha);
    }
  });
});
