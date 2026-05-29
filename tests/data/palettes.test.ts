import { describe, it, expect } from 'vitest';
import { PALETTES } from '../../src/data/palettes';

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

describe('palettes', () => {
  it('exports 3 palettes: nightfall, eclipse, aurora', () => {
    const ids = PALETTES.map((p) => p.id);
    expect(ids).toEqual(['nightfall', 'eclipse', 'aurora']);
  });

  it('each palette has a valid hex background and at least one variant', () => {
    for (const p of PALETTES) {
      expect(p.background).toMatch(HEX_RE);
      expect(p.blobVariants.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('each variant has stops with monotonically increasing offsets in [0,1] and valid colors/alphas', () => {
    for (const p of PALETTES) {
      for (const variant of p.blobVariants) {
        expect(variant.stops.length).toBeGreaterThanOrEqual(2);
        let prev = -1;
        for (const stop of variant.stops) {
          expect(stop.offset).toBeGreaterThanOrEqual(0);
          expect(stop.offset).toBeLessThanOrEqual(1);
          expect(stop.offset).toBeGreaterThan(prev);
          prev = stop.offset;
          expect(stop.color).toMatch(HEX_RE);
          expect(stop.alpha).toBeGreaterThanOrEqual(0);
          expect(stop.alpha).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('variantWeights length matches blobVariants length when provided', () => {
    for (const p of PALETTES) {
      if (p.variantWeights) {
        expect(p.variantWeights.length).toBe(p.blobVariants.length);
      }
    }
  });

  it('aurora has 2 variants with weights [0.7, 0.3]', () => {
    const aurora = PALETTES.find((p) => p.id === 'aurora')!;
    expect(aurora.blobVariants.length).toBe(2);
    expect(aurora.variantWeights).toEqual([0.7, 0.3]);
  });
});
