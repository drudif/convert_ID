import { describe, it, expect } from 'vitest';
import { generateComposition } from '../../src/renderer/composition';
import { PALETTES } from '../../src/data/palettes';

const nightfall = PALETTES.find((p) => p.id === 'nightfall')!;
const aurora = PALETTES.find((p) => p.id === 'aurora')!;

describe('generateComposition', () => {
  it('is deterministic: same inputs produce identical output', () => {
    const a = generateComposition(123, 4, nightfall, 0);
    const b = generateComposition(123, 4, nightfall, 0);
    expect(a).toEqual(b);
  });

  it('produces blobCount * 8 blobs (clusters of 8 minis per logical blob)', () => {
    const comp = generateComposition(1, 5, nightfall, 0);
    expect(comp.blobs).toHaveLength(40);
  });

  it('records the seed', () => {
    const comp = generateComposition(99, 3, nightfall, 0);
    expect(comp.seed).toBe(99);
  });

  it('x and y are in [0, 1]', () => {
    const comp = generateComposition(7, 8, nightfall, 0);
    for (const b of comp.blobs) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x).toBeLessThanOrEqual(1);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeLessThanOrEqual(1);
    }
  });

  it('radius is positive and < 1 (scaled by 1/sqrt(8) from baseR plus variation)', () => {
    const comp = generateComposition(7, 8, nightfall, 0.5);
    for (const b of comp.blobs) {
      expect(b.radius).toBeGreaterThan(0);
      expect(b.radius).toBeLessThan(1);
    }
  });

  it('variantIdx is a valid index into palette.blobVariants', () => {
    const comp = generateComposition(7, 50, aurora, 0);
    for (const b of comp.blobs) {
      expect(b.variantIdx).toBeGreaterThanOrEqual(0);
      expect(b.variantIdx).toBeLessThan(aurora.blobVariants.length);
    }
  });

  it('over many blobs, aurora variant weights roughly match (0.7 / 0.3)', () => {
    // All 8 minis in a cluster share the same variantIdx; sample one per cluster.
    const comp = generateComposition(42, 1000, aurora, 0);
    const counts = [0, 0];
    for (let i = 0; i < comp.blobs.length; i += 8) counts[comp.blobs[i].variantIdx]++;
    const ratio0 = counts[0] / 1000;
    expect(ratio0).toBeGreaterThan(0.6);
    expect(ratio0).toBeLessThan(0.8);
  });

  it('irregularity=0 collapses each cluster to identical stacked minis', () => {
    const comp = generateComposition(5, 3, nightfall, 0);
    expect(comp.blobs).toHaveLength(24);
    for (let g = 0; g < 3; g++) {
      const group = comp.blobs.slice(g * 8, g * 8 + 8);
      for (const m of group) {
        expect(m.x).toBe(group[0].x);
        expect(m.y).toBe(group[0].y);
        expect(m.radius).toBe(group[0].radius);
      }
    }
  });

  it('irregularity>0 produces blobCount * 8 blobs', () => {
    const comp = generateComposition(5, 3, nightfall, 0.5);
    expect(comp.blobs).toHaveLength(24);
  });

  it('irregularity>0 clusters mini-blobs near a center', () => {
    // For each logical blob (group of 8 mini-blobs), at least 2 minis
    // should be within 0.7 normalized distance of each other.
    const comp = generateComposition(7, 2, nightfall, 0.5);
    expect(comp.blobs).toHaveLength(16);
    for (let g = 0; g < 2; g++) {
      const group = comp.blobs.slice(g * 8, g * 8 + 8);
      let closePairs = 0;
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const dx = group[i].x - group[j].x;
          const dy = group[i].y - group[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 0.7) closePairs++;
        }
      }
      expect(closePairs).toBeGreaterThanOrEqual(1);
    }
  });

  it('is deterministic with irregularity', () => {
    const a = generateComposition(42, 3, nightfall, 0.5);
    const b = generateComposition(42, 3, nightfall, 0.5);
    expect(a).toEqual(b);
  });
});
