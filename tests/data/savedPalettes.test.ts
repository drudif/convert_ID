import { describe, it, expect } from 'vitest';
import {
  serializePalettes,
  parsePalettesFile,
  savedToPalette,
  type SavedPalette,
} from '../../src/data/savedPalettes';

const sample: SavedPalette = {
  id: 'saved-abc',
  name: 'Pôr do sol',
  colors: ['#101020', '#ffd479', '#ff7a4d', '#ec4899', '#6b46c1', '#3a1d6d', '#1a0d3d'],
};

describe('savedPalettes', () => {
  it('round-trips through serialize/parse', () => {
    const parsed = parsePalettesFile(serializePalettes([sample]));
    expect(parsed).toEqual([sample]);
  });

  it('drops entries with wrong colour count or bad hex', () => {
    const bad = JSON.stringify([
      { id: '1', name: 'too few', colors: ['#fff', '#000'] },
      { id: '2', name: 'bad hex', colors: Array(7).fill('red') },
      { id: '3', name: '', colors: Array(7).fill('#ffffff') },
      sample,
    ]);
    const parsed = parsePalettesFile(bad);
    expect(parsed).toEqual([sample]);
  });

  it('returns [] for non-array input', () => {
    expect(parsePalettesFile('{"nope": true}')).toEqual([]);
  });

  it('builds a renderable palette preserving id and name', () => {
    const pal = savedToPalette(sample);
    expect(pal.id).toBe(sample.id);
    expect(pal.name).toBe(sample.name);
    expect(pal.background).toBe(sample.colors[0]);
    expect(pal.blobVariants[0].stops[0].color).toBe(sample.colors[1]);
  });
});
