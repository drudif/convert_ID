import { describe, it, expect } from 'vitest';
import { render } from '../../src/renderer/render';
import { generateComposition } from '../../src/renderer/composition';
import { PALETTES } from '../../src/data/palettes';
import type { RenderParams } from '../../src/types';

const nightfall = PALETTES.find((p) => p.id === 'nightfall')!;

function makeParams(overrides: Partial<RenderParams> = {}): RenderParams {
  return {
    width: 200,
    height: 200,
    palette: nightfall,
    composition: generateComposition(1, 3, nightfall),
    grain: 0.5,
    irregularity: 0,
    ring0Weight: 0.07, ring0Fluidez: 0.25,
    ring1Weight: 0.18, ring1Fluidez: 0.25,
    ring2Weight: 0.35, ring2Fluidez: 0.25,
    ring3Weight: 0.55, ring3Fluidez: 0.25,
    ring4Weight: 0.80, ring4Fluidez: 0.25,
    ...overrides,
  };
}

describe('render', () => {
  it('does not throw with valid params', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 200;
    expect(() => render(canvas, makeParams())).not.toThrow();
  });

  it('does not throw with grain=0 and blur=0', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    expect(() =>
      render(canvas, makeParams({ width: 100, height: 100, grain: 0, blur: 0 })),
    ).not.toThrow();
  });

  it('does not throw with non-square dimensions', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 100;
    expect(() =>
      render(canvas, makeParams({ width: 400, height: 100 })),
    ).not.toThrow();
  });

  it('does not throw with 0 blobs', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    expect(() =>
      render(
        canvas,
        makeParams({
          width: 100,
          height: 100,
          composition: { seed: 0, blobs: [] },
        }),
      ),
    ).not.toThrow();
  });
});
