import { describe, it, expect } from 'vitest';
import { PALETTES, buildCustomPalette } from '../../src/data/palettes';

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

describe('buildCustomPalette', () => {
  const sampleColors: [string, string, string, string, string] = [
    '#111111', '#ff0000', '#00ff00', '#0000ff', '#ffffff',
  ];

  it('returns a Palette with id="custom" and the given background', () => {
    const palette = buildCustomPalette(sampleColors);
    expect(palette.id).toBe('custom');
    expect(palette.background).toBe('#111111');
  });

  it('produces 1 variant with 4 stops', () => {
    const palette = buildCustomPalette(sampleColors);
    expect(palette.blobVariants).toHaveLength(1);
    expect(palette.blobVariants[0].stops).toHaveLength(4);
  });

  it('assigns colors to stops in order (centro, anel 1, anel 2, borda)', () => {
    const palette = buildCustomPalette(sampleColors);
    const stops = palette.blobVariants[0].stops;
    expect(stops[0].color).toBe('#ff0000');
    expect(stops[1].color).toBe('#00ff00');
    expect(stops[2].color).toBe('#0000ff');
    expect(stops[3].color).toBe('#ffffff');
  });

  it('uses fixed alphas [1.0, 0.85, 0.5, 0.0] and offsets [0, 0.33, 0.66, 1]', () => {
    const palette = buildCustomPalette(sampleColors);
    const stops = palette.blobVariants[0].stops;
    expect(stops.map((s) => s.alpha)).toEqual([1.0, 0.85, 0.5, 0.0]);
    expect(stops.map((s) => s.offset)).toEqual([0, 0.33, 0.66, 1]);
  });
});
