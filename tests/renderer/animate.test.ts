import { describe, it, expect } from 'vitest';
import { morphOffset } from '../../src/renderer/animate';

describe('morphOffset', () => {
  it('returns the base offset unchanged when amp is 0', () => {
    expect(morphOffset(0.3, -0.4, 12.5, 0)).toEqual([0.3, -0.4]);
  });

  it('perturbs the offset when amp > 0 and the result evolves over time', () => {
    const a = morphOffset(0.3, -0.4, 0, 0.5);
    const b = morphOffset(0.3, -0.4, 1.5, 0.5);
    expect(a).not.toEqual([0.3, -0.4]);
    expect(a).not.toEqual(b); // moves as time advances
    for (const v of [...a, ...b]) expect(Number.isFinite(v)).toBe(true);
  });

  it('gives different minis different phases (no rigid translation)', () => {
    const m1 = morphOffset(0.5, 0.5, 2, 0.5);
    const m2 = morphOffset(-0.5, 0.2, 2, 0.5);
    const d1 = [m1[0] - 0.5, m1[1] - 0.5];
    const d2 = [m2[0] - -0.5, m2[1] - 0.2];
    expect(d1).not.toEqual(d2); // distinct displacement per mini
  });
});
