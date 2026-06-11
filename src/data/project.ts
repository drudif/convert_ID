import type { MeshColorMode, RenderMode } from '../types';
import type { PaletteColors } from './savedPalettes';

// Snapshot completo da ferramenta: todos os parâmetros editáveis + as cores
// ativas. Serializa/carrega como .json. paletteId é preservado, mas customColors
// SEMPRE carrega o snapshot das 7 cores na tela — então o look é reproduzível
// mesmo se o preset referenciado não existir no build onde o arquivo for aberto.
export type ProjectState = {
  // formato
  width: number;
  height: number;
  videoQuality: '1080' | '4k';
  videoFpsHeatmap: 60 | 24 | 18 | 12;
  videoFpsMesh: 60 | 24 | 18 | 12;
  // paleta / cores
  paletteId: string;
  customColors: PaletteColors;
  deletedColors: number[]; // índices (1..5) dos anéis internos colapsados
  // forma
  mode: RenderMode;
  blobCount: number;
  irregularity: number;
  warp: number;
  warpScale: number;
  blobSizeMin: number;
  blobSizeMax: number;
  blobSizeVar: number;
  blobAnchorX: number;
  blobAnchorY: number;
  blobFree: boolean;
  blobBordas: boolean;
  assetBands: number;
  assetWarp: number;
  assetCore: number;
  assetPresence: number[];
  seed: number;
  grainHeatmap: number;
  grainMesh: number;
  // animação
  speedHeatmap: number;
  speedMesh: number;
  morphAmpHeatmap: number;
  morphAmpMesh: number;
  meshFlow: number;
  meshFlowDir: 1 | -1;
  drift: number;
  flowDensity: number;
  flowSize: number;
  spawnRate: number;
  spawnLife: number;
  spawnSize: number;
  spawnSizeVar: number;
  // mesh
  meshLevels: number;
  meshLineWidth: number;
  meshRelief: number;
  meshLineColor: string;
  meshColorMode: MeshColorMode;
  // anéis (tamanho + fluidez)
  ring0Weight: number;
  ring0Fluidez: number;
  ring1Weight: number;
  ring1Fluidez: number;
  ring2Weight: number;
  ring2Fluidez: number;
  ring3Weight: number;
  ring3Fluidez: number;
  ring4Weight: number;
  ring4Fluidez: number;
  bordaWeight: number;
  bordaFluidez: number;
};

const TYPE = 'convert_id_gen.project';
const VERSION = 1;

const NUM_KEYS: Array<keyof ProjectState> = [
  'width', 'height', 'blobCount', 'irregularity', 'warp', 'warpScale', 'seed', 'grainHeatmap', 'grainMesh',
  'blobSizeMin', 'blobSizeMax', 'blobSizeVar', 'blobAnchorX', 'blobAnchorY',
  'assetBands', 'assetWarp', 'assetCore',
  'speedHeatmap', 'speedMesh', 'morphAmpHeatmap', 'morphAmpMesh', 'meshFlow',
  'drift', 'flowDensity', 'flowSize',
  'spawnRate', 'spawnLife', 'spawnSize', 'spawnSizeVar',
  'meshLevels', 'meshLineWidth', 'meshRelief',
  'ring0Weight', 'ring0Fluidez', 'ring1Weight', 'ring1Fluidez',
  'ring2Weight', 'ring2Fluidez', 'ring3Weight', 'ring3Fluidez',
  'ring4Weight', 'ring4Fluidez', 'bordaWeight', 'bordaFluidez',
];

function isHex6(c: unknown): c is string {
  return typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c);
}

export function serializeProject(s: ProjectState): string {
  return JSON.stringify({ type: TYPE, version: VERSION, ...s }, null, 2);
}

// Validação tolerante: só os campos bem-formados entram no resultado. Campos
// ausentes/inválidos são ignorados (o App mantém o valor atual deles).
export function parseProject(text: string): Partial<ProjectState> {
  const d = JSON.parse(text) as Record<string, unknown>;
  if (!d || typeof d !== 'object') return {};
  const out: Partial<ProjectState> = {};
  const nums = out as Record<string, number>;

  for (const k of NUM_KEYS) {
    const v = d[k];
    if (typeof v === 'number' && Number.isFinite(v)) nums[k] = v;
  }

  if (typeof d.blobFree === 'boolean') out.blobFree = d.blobFree;
  if (typeof d.blobBordas === 'boolean') out.blobBordas = d.blobBordas;
  if (d.mode === 'heatmap' || d.mode === 'mesh' || d.mode === 'asset') out.mode = d.mode;
  if (d.meshColorMode === 'solid' || d.meshColorMode === 'palette') out.meshColorMode = d.meshColorMode;
  if (d.meshFlowDir === 1 || d.meshFlowDir === -1) out.meshFlowDir = d.meshFlowDir;
  if (d.videoQuality === '1080' || d.videoQuality === '4k') out.videoQuality = d.videoQuality;
  const fpsOk = (v: unknown): v is 60 | 24 | 18 | 12 => v === 60 || v === 24 || v === 18 || v === 12;
  if (fpsOk(d.videoFpsHeatmap)) out.videoFpsHeatmap = d.videoFpsHeatmap;
  if (fpsOk(d.videoFpsMesh)) out.videoFpsMesh = d.videoFpsMesh;
  if (isHex6(d.meshLineColor)) out.meshLineColor = d.meshLineColor;
  if (typeof d.paletteId === 'string' && d.paletteId) out.paletteId = d.paletteId;

  if (Array.isArray(d.customColors) && d.customColors.length === 7 && d.customColors.every(isHex6)) {
    out.customColors = d.customColors as PaletteColors;
  }

  if (Array.isArray(d.assetPresence) && d.assetPresence.length === 6
      && d.assetPresence.every((n) => typeof n === 'number' && Number.isFinite(n))) {
    out.assetPresence = d.assetPresence as number[];
  }

  if (Array.isArray(d.deletedColors)) {
    const del = [...new Set(d.deletedColors.filter((n) => Number.isInteger(n) && n >= 1 && n <= 5))] as number[];
    out.deletedColors = del.slice(0, 3); // no máx. 3 deletados (mín. 2 internos ativos)
  }

  // Compat: arquivos antigos tinham valores únicos (globais). Mapeia p/ ambos os modos.
  if (typeof d.grain === 'number' && Number.isFinite(d.grain)) {
    if (out.grainHeatmap === undefined) out.grainHeatmap = d.grain;
    if (out.grainMesh === undefined) out.grainMesh = d.grain;
  }
  if (typeof d.morphAmp === 'number' && Number.isFinite(d.morphAmp)) {
    if (out.morphAmpHeatmap === undefined) out.morphAmpHeatmap = d.morphAmp;
    if (out.morphAmpMesh === undefined) out.morphAmpMesh = d.morphAmp;
  }
  if (fpsOk(d.videoFps)) {
    if (out.videoFpsHeatmap === undefined) out.videoFpsHeatmap = d.videoFps;
    if (out.videoFpsMesh === undefined) out.videoFpsMesh = d.videoFps;
  }

  return out;
}
