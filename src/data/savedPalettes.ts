import type { Palette } from '../types';
import { buildCustomPalette } from './palettes';

export type PaletteColors = [string, string, string, string, string, string, string];

// A user-saved palette is just the 7 custom colours plus a name/id. It renders
// through buildCustomPalette, exactly like the inline Custom palette.
export type SavedPalette = {
  id: string;
  name: string;
  colors: PaletteColors;
};

const KEY = 'auragen.savedPalettes';

function isHex6(c: unknown): c is string {
  return typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c);
}

// Tolerant validation — used for both localStorage reads and imported files, so
// malformed/old data is silently dropped instead of crashing the app.
function sanitize(data: unknown): SavedPalette[] {
  if (!Array.isArray(data)) return [];
  const out: SavedPalette[] = [];
  for (const item of data) {
    if (!item || typeof item !== 'object') continue;
    const { id, name, colors } = item as Record<string, unknown>;
    if (typeof name !== 'string' || !name.trim()) continue;
    if (!Array.isArray(colors) || colors.length !== 7 || !colors.every(isHex6)) continue;
    out.push({
      id: typeof id === 'string' && id ? id : newId(),
      name: name.trim(),
      colors: colors as PaletteColors,
    });
  }
  return out;
}

export function newId(): string {
  return `saved-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function loadSavedPalettes(): SavedPalette[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? sanitize(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

export function persistSavedPalettes(list: SavedPalette[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable (private mode / quota) — keep working in-memory */
  }
}

export function savedToPalette(p: SavedPalette): Palette {
  return { ...buildCustomPalette(p.colors), id: p.id, name: p.name };
}

export function serializePalettes(list: SavedPalette[]): string {
  return JSON.stringify(list, null, 2);
}

export function parsePalettesFile(text: string): SavedPalette[] {
  return sanitize(JSON.parse(text));
}
