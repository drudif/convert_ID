import { describe, it, expect } from 'vitest';
import { mulberry32 } from '../../src/lib/prng';

describe('mulberry32', () => {
  it('is deterministic: same seed produces same sequence', () => {
    const rngA = mulberry32(42);
    const rngB = mulberry32(42);
    const seqA = [rngA(), rngA(), rngA()];
    const seqB = [rngB(), rngB(), rngB()];
    expect(seqA).toEqual(seqB);
  });

  it('different seeds produce different sequences', () => {
    const rngA = mulberry32(1);
    const rngB = mulberry32(2);
    expect(rngA()).not.toEqual(rngB());
  });

  it('returns floats in [0, 1)', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 100; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
