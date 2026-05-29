import { describe, it, expect } from 'vitest';
import { generateComposition } from '../../src/renderer/composition';
import { PALETTES } from '../../src/data/palettes';

const nightfall = PALETTES.find((p) => p.id === 'nightfall')!;
const aurora = PALETTES.find((p) => p.id === 'aurora')!;

describe('generateComposition', () => {
  it('is deterministic: same inputs produce identical output', () => {
    const a = generateComposition(123, 4, nightfall);
    const b = generateComposition(123, 4, nightfall);
    expect(a).toEqual(b);
  });

  it('produces exactly blobCount blobs (one per logical blob)', () => {
    const comp = generateComposition(1, 5, nightfall);
    expect(comp.blobs).toHaveLength(5);
  });

  it('records the seed', () => {
    const comp = generateComposition(99, 3, nightfall);
    expect(comp.seed).toBe(99);
  });

  it('x and y are in [0, 1]', () => {
    const comp = generateComposition(7, 8, nightfall);
    for (const b of comp.blobs) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x).toBeLessThanOrEqual(1);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeLessThanOrEqual(1);
    }
  });

  it('radius is in [0.2, 0.5]', () => {
    const comp = generateComposition(7, 8, nightfall);
    for (const b of comp.blobs) {
      expect(b.radius).toBeGreaterThanOrEqual(0.2);
      expect(b.radius).toBeLessThanOrEqual(0.5);
    }
  });

  it('variantIdx is a valid index into palette.blobVariants', () => {
    const comp = generateComposition(7, 50, aurora);
    for (const b of comp.blobs) {
      expect(b.variantIdx).toBeGreaterThanOrEqual(0);
      expect(b.variantIdx).toBeLessThan(aurora.blobVariants.length);
    }
  });

  it('over many blobs, aurora variant weights roughly match (0.7 / 0.3)', () => {
    const comp = generateComposition(42, 1000, aurora);
    const counts = [0, 0];
    for (const b of comp.blobs) counts[b.variantIdx]++;
    const ratio0 = counts[0] / 1000;
    expect(ratio0).toBeGreaterThan(0.6);
    expect(ratio0).toBeLessThan(0.8);
  });

  it('each blob carries three outline harmonics (amps in [-1,1], phases in [0, 2π])', () => {
    const comp = generateComposition(11, 4, nightfall);
    for (const b of comp.blobs) {
      expect(b.harmonics.amps).toHaveLength(3);
      expect(b.harmonics.phases).toHaveLength(3);
      for (const a of b.harmonics.amps) {
        expect(a).toBeGreaterThanOrEqual(-1);
        expect(a).toBeLessThanOrEqual(1);
      }
      for (const p of b.harmonics.phases) {
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThan(Math.PI * 2);
      }
    }
  });

  it('different seeds produce different harmonics (so blobs have distinct outlines)', () => {
    const a = generateComposition(1, 1, nightfall);
    const b = generateComposition(2, 1, nightfall);
    expect(a.blobs[0].harmonics.amps).not.toEqual(b.blobs[0].harmonics.amps);
  });
});
