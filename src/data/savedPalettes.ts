import type { Palette } from '../types';
import { buildCustomPalette } from './palettes';

export type PaletteColors = [string, string, string, string, string, string, string];

// A user-saved palette is just the 7 custom colours plus a name/id. It renders
// through buildCustomPalette, exactly like the inline Custom palette.
export type SavedPalette = {
  id: string;
  name: string;
  colors: PaletteColors;
  // Anéis internos (1..5 = º0…º4) deletados/colapsados nesta paleta. Permite
  // salvar paletas com menos cores. Ausente/vazio = todas as cores ativas.
  deletedColors?: number[];
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
    const rawDel = (item as Record<string, unknown>).deletedColors;
    const deletedColors = Array.isArray(rawDel)
      ? ([...new Set(rawDel.filter((n) => Number.isInteger(n) && n >= 1 && n <= 5))] as number[]).slice(0, 3)
      : undefined;
    out.push({
      id: typeof id === 'string' && id ? id : newId(),
      name: name.trim(),
      colors: colors as PaletteColors,
      ...(deletedColors && deletedColors.length ? { deletedColors } : {}),
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

// 7 cores efetivas de uma paleta (Fundo + º0…º4 + Borda), respeitando o marcador
// de fade da Borda (alpha < 0.05 → usa o fundo).
export function paletteColors(p: Palette): PaletteColors {
  const bg = p.background;
  const s = p.blobVariants[0].stops;
  const ring = (i: number) => (s[i].alpha < 0.05 ? bg : s[i].color);
  return [bg, ring(0), ring(1), ring(2), ring(3), ring(4), ring(5)];
}

// Edições salvas dos presets embutidos (override permanente em localStorage).
// `name` opcional permite renomear um preset embutido.
export type PaletteOverride = { colors: PaletteColors; deletedColors: number[]; name?: string };
const OVR_KEY = 'auragen.paletteOverrides';
const DEL_KEY = 'auragen.deletedPresets';

export function loadOverrides(): Record<string, PaletteOverride> {
  try {
    const raw = localStorage.getItem(OVR_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return {};
    const out: Record<string, PaletteOverride> = {};
    for (const [id, v] of Object.entries(data as Record<string, unknown>)) {
      const o = v as Record<string, unknown>;
      const colors = o?.colors;
      if (!Array.isArray(colors) || colors.length !== 7 || !colors.every(isHex6)) continue;
      const del = Array.isArray(o.deletedColors)
        ? ([...new Set(o.deletedColors.filter((n) => Number.isInteger(n) && n >= 1 && n <= 5))] as number[]).slice(0, 3)
        : [];
      const name = typeof o.name === 'string' && o.name.trim() ? o.name.trim() : undefined;
      out[id] = { colors: colors as PaletteColors, deletedColors: del, ...(name ? { name } : {}) };
    }
    return out;
  } catch {
    return {};
  }
}

export function persistOverrides(o: Record<string, PaletteOverride>): void {
  try {
    localStorage.setItem(OVR_KEY, JSON.stringify(o));
  } catch {
    /* storage unavailable — keep working in-memory */
  }
}

// Presets embutidos ocultados pelo usuário (deletados).
export function loadDeletedPresets(): string[] {
  try {
    const raw = localStorage.getItem(DEL_KEY);
    const d = raw ? JSON.parse(raw) : [];
    return Array.isArray(d) ? d.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function persistDeletedPresets(list: string[]): void {
  try {
    localStorage.setItem(DEL_KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable */
  }
}

export function serializePalettes(list: SavedPalette[]): string {
  return JSON.stringify(list, null, 2);
}

export function parsePalettesFile(text: string): SavedPalette[] {
  return sanitize(JSON.parse(text));
}
