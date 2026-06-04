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
    mode: 'heatmap',
    grain: 0.5,
    irregularity: 0,
    time: 0, morphAmp: 0.5, meshFlow: 0.5, meshFlowDir: -1,
    drift: 0, flowDensity: 6, flowSize: 0.18,
    spawnRate: 0, spawnLife: 4, spawnSize: 0.18, spawnSizeVar: 0.5,
    meshLevels: 24, meshLineWidth: 1, meshRelief: 0.6, meshLineColor: '#ec4899', meshColorMode: 'solid',
    ring0Weight: 0.04, ring0Fluidez: 0.25,
    ring1Weight: 0.15, ring1Fluidez: 0.25,
    ring2Weight: 0.30, ring2Fluidez: 0.25,
    ring3Weight: 0.50, ring3Fluidez: 0.25,
    ring4Weight: 0.70, ring4Fluidez: 0.25,
    bordaWeight: 0.85, bordaFluidez: 0.25,
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

  it('renders mesh mode without throwing', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 200;
    expect(() => render(canvas, makeParams({ mode: 'mesh' }))).not.toThrow();
  });

  it('renders mesh mode with 0 blobs', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 120;
    canvas.height = 120;
    expect(() =>
      render(
        canvas,
        makeParams({ mode: 'mesh', width: 120, height: 120, composition: { seed: 7, blobs: [] } }),
      ),
    ).not.toThrow();
  });

  it('renders mesh mode following the palette', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 200;
    expect(() =>
      render(canvas, makeParams({ mode: 'mesh', meshColorMode: 'palette' })),
    ).not.toThrow();
  });

  it('renders animated frames (morph + flow) without throwing', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 200;
    for (const mode of ['heatmap', 'mesh'] as const) {
      for (const time of [0, 1.7, 4.2]) {
        expect(() =>
          render(canvas, makeParams({ mode, time, irregularity: 1, morphAmp: 0.6, meshFlow: 0.5 })),
        ).not.toThrow();
      }
    }
  });

  it('renders heatmap flow + surgimento together without throwing', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 160;
    for (const time of [0, 3, 9.5, 50]) {
      expect(() =>
        render(canvas, makeParams({
          mode: 'heatmap', time, drift: 0.6, flowDensity: 8, flowSize: 0.2,
          spawnRate: 1.5, spawnLife: 5, spawnSize: 0.2,
        })),
      ).not.toThrow();
    }
  });

  it('renders surgimento alone (drift = 0) without throwing', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 160;
    expect(() =>
      render(canvas, makeParams({ mode: 'heatmap', time: 6, drift: 0, spawnRate: 2 })),
    ).not.toThrow();
  });

  it('mesh flow direction sign does not throw either way', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 160;
    for (const meshFlowDir of [1, -1] as const) {
      expect(() =>
        render(canvas, makeParams({ mode: 'mesh', time: 3, meshFlow: 0.7, meshFlowDir })),
      ).not.toThrow();
    }
  });
});
