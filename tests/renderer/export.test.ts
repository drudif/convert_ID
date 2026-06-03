import { describe, it, expect } from 'vitest';
import { exportFilename } from '../../src/renderer/export';

describe('exportFilename', () => {
  it('matches the pattern convert_ID_GEN-{paletteId}-{seed}-{W}x{H}.png', () => {
    expect(exportFilename('nightfall', 42, 1920, 1080)).toBe(
      'convert_ID_GEN-nightfall-42-1920x1080.png',
    );
  });

  it('handles negative seeds', () => {
    expect(exportFilename('aurora', -1, 800, 600)).toBe(
      'convert_ID_GEN-aurora--1-800x600.png',
    );
  });

  it('handles all palette ids', () => {
    expect(exportFilename('eclipse', 1, 100, 100)).toBe(
      'convert_ID_GEN-eclipse-1-100x100.png',
    );
  });
});
