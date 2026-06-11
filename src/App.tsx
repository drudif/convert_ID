import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { ImagemPanel, VideoPanel, ColorRingsDock, type ControlsProps } from './components/Controls';
import { Preview, type Zoom } from './components/Preview';
import { PALETTES, buildCustomPalette } from './data/palettes';
import {
  loadSavedPalettes,
  persistSavedPalettes,
  savedToPalette,
  paletteColors,
  loadOverrides,
  persistOverrides,
  loadDeletedPresets,
  persistDeletedPresets,
  newId,
  type SavedPalette,
  type PaletteColors,
  type PaletteOverride,
} from './data/savedPalettes';
import {
  serializeProject,
  parseProject,
  type ProjectState,
} from './data/project';
import { generateComposition } from './renderer/composition';
import { exportPNG } from './renderer/export';
// NOTE: ./renderer/exportVideo (mp4-muxer + WebCodecs) is imported lazily inside
// handleExportVideo so the heavy/optional encoder never affects initial load.
import type { MeshColorMode, Palette, RenderMode, RenderParams, StyleParams } from './types';

export default function App() {
  const [width, setWidth] = useState(3840);
  const [height, setHeight] = useState(2160);
  // Presets são editáveis diretamente (não há mais "Custom"). customColors é o
  // RASCUNHO da paleta ativa; `edited` marca alterações não salvas. Salvar grava
  // um override permanente; trocar de paleta sem salvar reverte ao último salvo.
  const [paletteOverrides, setPaletteOverrides] = useState<Record<string, PaletteOverride>>(() => loadOverrides());
  const [paletteId, setPaletteId] = useState('convert');
  const [customColors, setCustomColors] = useState<PaletteColors>(() => {
    const ovr = loadOverrides().convert;
    if (ovr) return ovr.colors;
    const p = PALETTES.find((x) => x.id === 'convert') ?? PALETTES[0];
    return paletteColors(p);
  });
  const [edited, setEdited] = useState(false);
  const [mode, setMode] = useState<RenderMode>('heatmap');
  const [blobCount, setBlobCount] = useState(3);
  // Irregularidade = separação de partículas (spread do cluster de minis).
  const [irregularity, setIrregularity] = useState(0.95);
  // Warp = deformação suave da silhueta (domain warp). `warpScale` = tamanho/raio
  // das deformações (0 = curtas, 1 = longas/alongadas). Funciona junto da irregularidade.
  const [warp, setWarp] = useState(0.55);
  const [warpScale, setWarpScale] = useState(0.73);
  // Tamanho dos blobs gerados (fração de min(w,h)) — range [min,max] + variação
  // (quanto o raio se espalha dentro do range: 1 = uniforme, 0 = todos no meio).
  const [blobSizeMin, setBlobSizeMin] = useState(0.12);
  const [blobSizeMax, setBlobSizeMax] = useState(0.28);
  const [blobSizeVar, setBlobSizeVar] = useState(1);
  // Orientação dos blobs no canvas (âncora 0..1). Centro = (0.5, 0.5).
  // blobFree = aleatório total no canvas inteiro (ignora a âncora).
  const [blobAnchorX, setBlobAnchorX] = useState(0.5);
  const [blobAnchorY, setBlobAnchorY] = useState(0.5);
  const [blobFree, setBlobFree] = useState(false);
  // bordas = blobs nas bordas (centro fora do canvas), vazando levemente pra dentro.
  const [blobBordas, setBlobBordas] = useState(false);
  // ASSET mode — toolset próprio. Presença centro→borda (º0…º4, Borda); º0 começa
  // ~20% do raio. Bandas: 10% menos que a 1ª geração (36 → 32). Distorção reduzida.
  const [assetBands, setAssetBands] = useState(25);
  const [assetWarp, setAssetWarp] = useState(0.5);
  const [assetCore, setAssetCore] = useState(7); // tamanho da banda pura central

  const [assetPresence, setAssetPresence] = useState<number[]>([1.25, 1, 1, 1, 1, 1]);
  const handleAssetPresence = (i: number, v: number) =>
    setAssetPresence((prev) => prev.map((p, k) => (k === i ? v : p)));
  // Animation. `playing`/`speed` drive the clock inside Preview; morph & flow
  // are static amounts fed into the render params (time is supplied per-frame).
  const [playing, setPlaying] = useState(false);
  // Speed is per render mode so each keeps its own default.
  const [speedHeatmap, setSpeedHeatmap] = useState(1);
  const [speedMesh, setSpeedMesh] = useState(0.9);
  const speed = mode === 'mesh' ? speedMesh : speedHeatmap;
  const handleSpeedChange = (s: number) =>
    (mode === 'mesh' ? setSpeedMesh : setSpeedHeatmap)(s);
  // Morph é por render mode: heat map nasce no máximo (1), mesh no mínimo (0).
  const [morphAmpHeatmap, setMorphAmpHeatmap] = useState(1);
  const [morphAmpMesh, setMorphAmpMesh] = useState(0);
  const morphAmp = mode === 'mesh' ? morphAmpMesh : morphAmpHeatmap;
  const handleMorphAmpChange = (v: number) =>
    (mode === 'mesh' ? setMorphAmpMesh : setMorphAmpHeatmap)(v);
  const [meshFlow, setMeshFlow] = useState(0.23);
  const [meshFlowDir, setMeshFlowDir] = useState<1 | -1>(-1); // -1 = outward
  // Heatmap liquid flow. drift = 0 keeps the static composition; > 0 turns the
  // heatmap into a continuous stream of blobs crossing and leaving the frame.
  const [drift, setDrift] = useState(0.42);
  const [flowDensity, setFlowDensity] = useState(4);
  const [flowSize, setFlowSize] = useState(0.06);
  const [spawnRate, setSpawnRate] = useState(0.8);
  const [spawnLife, setSpawnLife] = useState(8);
  const [spawnSize, setSpawnSize] = useState(0.15);
  const [spawnSizeVar, setSpawnSizeVar] = useState(0.97);
  // Grain is per render mode (like speed). Heat map compensates for resolution
  // (finer/less visible at 4K): 0.17 at 4K, 0.13 at 1080, and re-applies that
  // default when the Formato changes (see effect). Mesh keeps a fixed default
  // (0.11). Both stay manually adjustable.
  const [grainHeatmap, setGrainHeatmap] = useState(0.17);
  const [grainMesh, setGrainMesh] = useState(0.11);
  const grain = mode === 'mesh' ? grainMesh : grainHeatmap;
  const handleGrainChange = (g: number) =>
    (mode === 'mesh' ? setGrainMesh : setGrainHeatmap)(g);
  // When importing a project that carries its own heat-map grain, skip the next
  // resolution-driven auto-grain so the imported value isn't clobbered.
  const skipGrainAutoRef = useRef(false);
  // Re-apply the resolution-appropriate heat-map grain when the output changes.
  useEffect(() => {
    if (skipGrainAutoRef.current) {
      skipGrainAutoRef.current = false;
      return;
    }
    setGrainHeatmap(Math.max(width, height) >= 3000 ? 0.17 : 0.13);
  }, [width, height]);
  // Mesh (topographic contour) mode params. Densidade e relevo são fixos; a
  // ESPESSURA segue a resolução (1.5 em 1080, 1.0 em 4K) — ver efeito abaixo.
  // Inicial = 1.0 pois o app abre em 4K.
  const [meshLevels, setMeshLevels] = useState(80);
  const [meshLineWidth, setMeshLineWidth] = useState(1.0);
  const [meshRelief, setMeshRelief] = useState(0.12);
  // Espessura da linha do mesh segue a resolução (1.5 em 1080, 1.0 em 4K). Skip
  // próprio p/ honrar o valor importado quando a resolução também muda no import.
  const skipMeshWidthAutoRef = useRef(false);
  useEffect(() => {
    if (skipMeshWidthAutoRef.current) {
      skipMeshWidthAutoRef.current = false;
      return;
    }
    setMeshLineWidth(Math.max(width, height) >= 3000 ? 1.0 : 1.5);
  }, [width, height]);
  // Estado mesh faz parte da paleta — inicia do override da paleta default (convert).
  const [meshLineColor, setMeshLineColor] = useState(() => loadOverrides().convert?.meshLineColor ?? '#ec4899');
  const [meshColorMode, setMeshColorMode] = useState<MeshColorMode>(() => loadOverrides().convert?.meshColorMode ?? 'solid');
  // Six nested rings (º0 innermost/hottest → Borda outermost = silhouette).
  // Each ring has SIZE (outer extent) and FLUIDEZ (boundary blur). Nesting
  // is enforced at render time — each inner ring is clamped to the next
  // outer one. º0 sits on top of all other layers.
  const [ring0Weight, setRing0Weight] = useState(0.04);
  const [ring0Fluidez, setRing0Fluidez] = useState(0.25);
  const [ring1Weight, setRing1Weight] = useState(0.15);
  const [ring1Fluidez, setRing1Fluidez] = useState(0.25);
  const [ring2Weight, setRing2Weight] = useState(0.30);
  const [ring2Fluidez, setRing2Fluidez] = useState(0.25);
  const [ring3Weight, setRing3Weight] = useState(0.50);
  const [ring3Fluidez, setRing3Fluidez] = useState(0.25);
  const [ring4Weight, setRing4Weight] = useState(0.70);
  const [ring4Fluidez, setRing4Fluidez] = useState(0.25);
  const [bordaWeight, setBordaWeight] = useState(0.85);
  const [bordaFluidez, setBordaFluidez] = useState(0.25);
  // Cores deletadas: índices em customColors dos anéis INTERNOS (1..5 = º0…º4)
  // que foram colapsados. Borda(6) e Fundo(0) nunca entram aqui. Mínimo de 2
  // internos ativos (logo, no máx. 3 deletados). Em deletion order (restaura no
  // estilo undo). A cor fica preservada em customColors p/ quando restaurar.
  const [deletedColors, setDeletedColors] = useState<number[]>(() => loadOverrides().convert?.deletedColors ?? []);
  const [seed, setSeed] = useState(1);
  const [exportError, setExportError] = useState<string | null>(null);
  const [videoProgress, setVideoProgress] = useState<{ done: number; total: number } | null>(null);
  const [videoQuality, setVideoQuality] = useState<'1080' | '4k'>('1080');
  // FPS de export por render mode: heat map → 12, mesh → 60.
  type Fps = 60 | 24 | 18 | 12;
  const [videoFpsHeatmap, setVideoFpsHeatmap] = useState<Fps>(12);
  const [videoFpsMesh, setVideoFpsMesh] = useState<Fps>(60);
  const videoFps = mode === 'mesh' ? videoFpsMesh : videoFpsHeatmap;
  const handleVideoFpsChange = (f: Fps) =>
    (mode === 'mesh' ? setVideoFpsMesh : setVideoFpsHeatmap)(f);
  const exportAbortRef = useRef<AbortController | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [zoom, setZoom] = useState<Zoom>('fit');
  const [savedPalettes, setSavedPalettes] = useState<SavedPalette[]>(() => loadSavedPalettes());
  const [deletedPresets, setDeletedPresets] = useState<string[]>(() => loadDeletedPresets());

  const builtinOf = (id: string) => PALETTES.find((p) => p.id === id);
  const savedOf = (id: string) => savedPalettes.find((p) => p.id === id);
  const nameOf = (id: string) =>
    paletteOverrides[id]?.name ?? builtinOf(id)?.name ?? savedOf(id)?.name ?? id;

  // Defaults do estado "mesh" e dos parâmetros de FORMA (estilo) — usados quando a
  // paleta não traz os seus.
  const MESH_MODE_DEFAULT: MeshColorMode = 'solid';
  const MESH_LINE_DEFAULT = '#ec4899';
  const STYLE_DEFAULT: StyleParams = {
    ringWeights: [0.04, 0.15, 0.30, 0.50, 0.70, 0.85],
    ringFluidez: [0.25, 0.25, 0.25, 0.25, 0.25, 0.25],
    blobCount: 3,
    blobSizeMin: 0.12,
    blobSizeMax: 0.28,
    blobSizeVar: 1,
    warp: 0.55,
    irregularity: 0.95,
    warpScale: 0.73,
  };

  // Estado SALVO de um Estilo (override > preset embutido > paleta salvada). Inclui
  // cores, deleções, estado mesh e os parâmetros de forma (style).
  const savedStateOf = (
    id: string,
  ): {
    colors: PaletteColors;
    deletedColors: number[];
    meshColorMode: MeshColorMode;
    meshLineColor: string;
    style: StyleParams;
  } => {
    const src = paletteOverrides[id] ?? savedOf(id);
    if (src) {
      return {
        colors: src.colors,
        deletedColors: src.deletedColors ?? [],
        meshColorMode: src.meshColorMode ?? MESH_MODE_DEFAULT,
        meshLineColor: src.meshLineColor ?? MESH_LINE_DEFAULT,
        style: src.style ?? STYLE_DEFAULT,
      };
    }
    const b = builtinOf(id);
    const colors = b ? paletteColors(b) : paletteColors(PALETTES[0]);
    return {
      colors,
      deletedColors: b?.deletedColors ?? [],
      meshColorMode: MESH_MODE_DEFAULT,
      meshLineColor: MESH_LINE_DEFAULT,
      style: b?.style ?? STYLE_DEFAULT,
    };
  };

  // Aplica um StyleParams no estado (setters crus — não marca edição).
  const applyStyle = (s: StyleParams) => {
    setRing0Weight(s.ringWeights[0]); setRing1Weight(s.ringWeights[1]); setRing2Weight(s.ringWeights[2]);
    setRing3Weight(s.ringWeights[3]); setRing4Weight(s.ringWeights[4]); setBordaWeight(s.ringWeights[5]);
    setRing0Fluidez(s.ringFluidez[0]); setRing1Fluidez(s.ringFluidez[1]); setRing2Fluidez(s.ringFluidez[2]);
    setRing3Fluidez(s.ringFluidez[3]); setRing4Fluidez(s.ringFluidez[4]); setBordaFluidez(s.ringFluidez[5]);
    setBlobCount(s.blobCount); setBlobSizeMin(s.blobSizeMin); setBlobSizeMax(s.blobSizeMax); setBlobSizeVar(s.blobSizeVar);
    setWarp(s.warp); setIrregularity(s.irregularity); setWarpScale(s.warpScale);
  };
  // Captura os parâmetros de forma atuais como um StyleParams.
  const currentStyle = (): StyleParams => ({
    ringWeights: [ring0Weight, ring1Weight, ring2Weight, ring3Weight, ring4Weight, bordaWeight],
    ringFluidez: [ring0Fluidez, ring1Fluidez, ring2Fluidez, ring3Fluidez, ring4Fluidez, bordaFluidez],
    blobCount, blobSizeMin, blobSizeMax, blobSizeVar, warp, irregularity, warpScale,
  });
  // No mount, aplica o style salvo do estilo ativo (ex.: override de convert).
  useEffect(() => {
    applyStyle(savedStateOf(paletteId).style);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Objeto Palette "salvo" de um id (preserva estrutura multi-variante de presets
  // não-editados, como Aurora; overrides/salvas viram custom single-variant).
  const actualPaletteOf = (id: string): Palette => {
    const ovr = paletteOverrides[id];
    if (ovr) return { ...buildCustomPalette(ovr.colors), id, name: nameOf(id) };
    const b = builtinOf(id);
    if (b) return b;
    const s = savedOf(id);
    if (s) return savedToPalette(s);
    return PALETTES[0];
  };

  // Editando → usa o rascunho (customColors). Senão → a paleta salva/embutida.
  const palette = useMemo(() => {
    if (edited) return { ...buildCustomPalette(customColors), id: paletteId, name: nameOf(paletteId) };
    return actualPaletteOf(paletteId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edited, customColors, paletteId, paletteOverrides, savedPalettes]);

  const composition = useMemo(
    () => generateComposition(seed, blobCount, palette, blobSizeMin, blobSizeMax, blobSizeVar, blobAnchorX, blobAnchorY, blobFree, blobBordas),
    [seed, blobCount, palette, blobSizeMin, blobSizeMax, blobSizeVar, blobAnchorX, blobAnchorY, blobFree, blobBordas],
  );

  // Para um anel interno deletado (stop k, 0..4), o índice do próximo anel ATIVO
  // externo (0..4) ou 5 = Borda. É nele que o anel deletado colapsa.
  const nextActiveOuterStop = (k: number): number => {
    for (let j = k + 1; j <= 4; j++) if (!deletedColors.includes(j + 1)) return j;
    return 5; // Borda
  };

  // Colapso dos anéis deletados SÓ no render: cada anel deletado vira um DUPLICADO
  // EXATO do próximo anel ativo externo — mesma cor, mesmo tamanho (peso) e mesma
  // FLUIDEZ. Assim sua presença fica idêntica à do vizinho e o composite é um no-op
  // (sem a franja/"fantasma" que sobrava da fluidez do anel escondido). A UI segue
  // mostrando as cores reais (preservadas).
  const renderPalette = useMemo(() => {
    if (deletedColors.length === 0) return palette;
    const outerColor = (stops: typeof palette.blobVariants[0]['stops'], k: number): string => {
      const j = nextActiveOuterStop(k);
      if (j === 5) return stops[5].alpha < 0.05 ? palette.background : stops[5].color;
      return stops[j].color;
    };
    return {
      ...palette,
      blobVariants: palette.blobVariants.map((v) => ({
        ...v,
        stops: v.stops.map((s, k) =>
          k <= 4 && deletedColors.includes(k + 1) ? { ...s, color: outerColor(v.stops, k) } : s,
        ),
      })),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [palette, deletedColors]);

  // Peso 1 colapsa o tamanho do anel deletado contra o vizinho externo, então ele
  // some da cadeia de aninhamento (não encolhe os anéis internos). A presença dele
  // é zerada no render via `deletedRings`, eliminando qualquer franja/"fantasma".
  const dw = (colorIdx: number, w: number) => (deletedColors.includes(colorIdx) ? 1 : w);

  // ASSET é sempre 1:1 em 4K (quadrado), independente do Formato. Heat map/Mesh
  // seguem a resolução do Formato.
  const ASSET_SIZE = 2160;
  const renderW = mode === 'asset' ? ASSET_SIZE : width;
  const renderH = mode === 'asset' ? ASSET_SIZE : height;

  const params: RenderParams = {
    width: renderW,
    height: renderH,
    palette: renderPalette,
    composition,
    mode,
    grain,
    irregularity,
    warp,
    warpScale,
    time: 0, // advanced per-frame inside Preview while playing
    morphAmp,
    meshFlow,
    meshFlowDir,
    drift, flowDensity, flowSize,
    spawnRate, spawnLife, spawnSize, spawnSizeVar,
    meshLevels, meshLineWidth, meshRelief, meshLineColor, meshColorMode,
    deletedRings: deletedColors,
    assetBands, assetWarp, assetCore, assetPresence,
    ring0Weight: dw(1, ring0Weight), ring0Fluidez,
    ring1Weight: dw(2, ring1Weight), ring1Fluidez,
    ring2Weight: dw(3, ring2Weight), ring2Fluidez,
    ring3Weight: dw(4, ring3Weight), ring3Fluidez,
    ring4Weight: dw(5, ring4Weight), ring4Fluidez,
    bordaWeight, bordaFluidez,
  };

  // Trocar de paleta carrega o estado SALVO dela (override/preset), descartando
  // qualquer edição não salva da paleta anterior — esse é o "reverter".
  const handlePaletteChange = (id: string) => {
    const st = savedStateOf(id);
    setCustomColors(st.colors);
    setDeletedColors(st.deletedColors);
    setMeshColorMode(st.meshColorMode);
    setMeshLineColor(st.meshLineColor);
    applyStyle(st.style);
    setPaletteId(id);
    setEdited(false);
  };

  // Volta o rascunho ao último estado salvo da paleta atual (botão Reverter).
  const handleRevertPalette = () => {
    const st = savedStateOf(paletteId);
    setCustomColors(st.colors);
    setDeletedColors(st.deletedColors);
    setMeshColorMode(st.meshColorMode);
    setMeshLineColor(st.meshLineColor);
    applyStyle(st.style);
    setEdited(false);
  };

  const handleCustomColorChange = (idx: number, color: string) => {
    setEdited(true);
    setCustomColors((prev) => {
      const next = [...prev] as PaletteColors;
      next[idx] = color;
      return next;
    });
  };

  // Estado mesh faz parte da paleta → editá-lo marca a paleta como não salva.
  const handleMeshColorModeChange = (m: MeshColorMode) => {
    setEdited(true);
    setMeshColorMode(m);
  };
  const handleMeshLineColorChange = (c: string) => {
    setEdited(true);
    setMeshLineColor(c);
  };

  // Índices ativos (não deletados) em ordem VISUAL: [º0…º4 ativos, Borda, Fundo].
  // Fundo(0) e Borda(6) sempre presentes.
  const activeOrder = (): number[] =>
    [1, 2, 3, 4, 5, 6, 0].filter((i) => i === 0 || i === 6 || !deletedColors.includes(i));

  // Reordena por inserção entre posições ATIVAS. `from`/`to` são índices em
  // customColors (a posição visual real do card). Move a cor e desloca as demais.
  const handleReorderColors = (from: number, to: number) => {
    if (from === to) return;
    const base = [...customColors] as PaletteColors;
    const order = activeOrder();
    const fromPos = order.indexOf(from);
    const toPos = order.indexOf(to);
    if (fromPos < 0 || toPos < 0) return;
    const vals = order.map((i) => base[i]);
    const [moved] = vals.splice(fromPos, 1);
    vals.splice(toPos, 0, moved);
    const result = [...base] as PaletteColors;
    order.forEach((i, k) => (result[i] = vals[k]));
    setEdited(true);
    setCustomColors(result);
  };

  // Deletar/restaurar cores (anéis internos colapsam no render; cor preservada).
  const handleDeleteColor = (colorIdx: number) => {
    if (colorIdx < 1 || colorIdx > 5) return; // só internos º0…º4
    if (5 - deletedColors.length <= 2) return; // mantém mínimo de 2 ativos
    setEdited(true);
    setDeletedColors((prev) => (prev.includes(colorIdx) ? prev : [...prev, colorIdx]));
  };
  const handleRestoreColor = () => {
    setEdited(true);
    setDeletedColors((prev) => prev.slice(0, -1));
  };

  const clamp = (v: number, lo: number, hi: number) =>
    v < lo ? lo : v > hi ? hi : v;

  // Ring size handlers — SEM trava entre vizinhos. O anel arrastado vai pro
  // valor exato; os anéis MAIORES (externos) sobem junto se ficarem menores que
  // ele, e os MENORES (internos) descem junto se ficarem maiores. O aninhamento
  // (º0 ≤ º1 ≤ … ≤ Borda) é mantido por arrasto, não por clamp.
  const ringWeights = [ring0Weight, ring1Weight, ring2Weight, ring3Weight, ring4Weight, bordaWeight];
  const ringSetters = [setRing0Weight, setRing1Weight, setRing2Weight, setRing3Weight, setRing4Weight, setBordaWeight];
  const setRingWeight = (i: number, raw: number) => {
    const v = clamp(raw, 0, 1);
    const next = [...ringWeights];
    next[i] = v;
    for (let j = i + 1; j < next.length; j++) if (next[j] < v) next[j] = v; // empurra externos ↑
    for (let j = i - 1; j >= 0; j--) if (next[j] > v) next[j] = v;          // empurra internos ↓
    setEdited(true); // tamanho do anel faz parte do estilo
    next.forEach((val, idx) => { if (val !== ringWeights[idx]) ringSetters[idx](val); });
  };
  const handleRing0Weight = (v: number) => setRingWeight(0, v);
  const handleRing1Weight = (v: number) => setRingWeight(1, v);
  const handleRing2Weight = (v: number) => setRingWeight(2, v);
  const handleRing3Weight = (v: number) => setRingWeight(3, v);
  const handleRing4Weight = (v: number) => setRingWeight(4, v);
  const handleBordaWeight = (v: number) => setRingWeight(5, v);

  const handleRandomize = () => {
    setSeed(Math.floor(Math.random() * 2 ** 31));
  };

  // Wrapper: marca o Estilo como não salvo (params de forma fazem parte dele).
  const markEd = (fn: (v: number) => void) => (v: number) => { setEdited(true); fn(v); };

  // Range de tamanho: min nunca passa do max e vice-versa (e marca edição).
  const handleBlobSizeMin = (v: number) => { setEdited(true); setBlobSizeMin(Math.min(v, blobSizeMax)); };
  const handleBlobSizeMax = (v: number) => { setEdited(true); setBlobSizeMax(Math.max(v, blobSizeMin)); };

  const handleDownload = () => {
    setExportError(null);
    exportPNG(params).catch((err: unknown) => {
      console.error(err);
      setExportError(err instanceof Error ? err.message : 'Falha ao exportar.');
    });
  };

  const VIDEO_DURATION = 10;
  // preview = quick 480p pass to check before committing to a full 1080 render.
  const handleExport = async (preview: boolean) => {
    if (videoProgress) return; // already running
    setExportError(null);
    setPlaying(false); // free CPU for the offline render
    // Video resolution is independent of the PNG/Formato — only the ORIENTATION
    // follows the image; the tier comes from the video's own quality toggle.
    const orient = width > height ? 'h' : width < height ? 'v' : 's';
    const dims = (tier: 'preview' | '1080' | '4k'): [number, number] => {
      if (tier === 'preview') return orient === 'h' ? [854, 480] : orient === 'v' ? [480, 854] : [480, 480];
      if (tier === '4k') return orient === 'h' ? [3840, 2160] : orient === 'v' ? [2160, 3840] : [2160, 2160];
      return orient === 'h' ? [1920, 1080] : orient === 'v' ? [1080, 1920] : [1080, 1080];
    };
    const [vw, vh] = dims(preview ? 'preview' : videoQuality);
    // Bitrate scales with resolution (~0.12 bits per pixel·frame), clamped.
    const bitrate = preview
      ? 2_500_000
      : Math.min(40_000_000, Math.max(4_000_000, Math.round(vw * vh * videoFps * 0.12)));
    // Grain follows the video's own resolution (≥3000 → 0.17, else 0.13).
    const videoGrain = Math.max(vw, vh) >= 3000 ? 0.17 : 0.13;
    const controller = new AbortController();
    exportAbortRef.current = controller;
    setVideoProgress({ done: 0, total: VIDEO_DURATION * videoFps });
    try {
      const { exportMp4 } = await import('./renderer/exportVideo');
      const blob = await exportMp4(
        { ...params, grain: videoGrain }, vw, vh, VIDEO_DURATION, videoFps,
        (done, total) => setVideoProgress({ done, total }),
        bitrate,
        controller.signal,
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `convert_ID_GEN-${mode}-${seed}-${vw}x${vh}-${videoFps}fps${preview ? '-preview' : ''}.mp4`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') {
        // user cancelled — silent
      } else {
        console.error(err);
        setExportError(err instanceof Error ? err.message : 'Falha ao exportar o vídeo.');
      }
    } finally {
      exportAbortRef.current = null;
      setVideoProgress(null);
    }
  };
  const handleExportVideo = () => handleExport(false);
  const handleExportPreview = () => handleExport(true);
  const handleCancelExport = () => exportAbortRef.current?.abort();

  // Salva as edições NA paleta ativa, pra sempre: preset embutido → override em
  // localStorage; paleta salvada → atualiza a entrada in-place.
  const handleSavePalette = () => {
    const st: PaletteOverride = {
      colors: [...customColors] as PaletteColors,
      deletedColors: [...deletedColors],
      meshColorMode,
      meshLineColor,
      style: currentStyle(),
    };
    if (builtinOf(paletteId)) {
      setPaletteOverrides((prev) => {
        const next = { ...prev, [paletteId]: st };
        persistOverrides(next);
        return next;
      });
    } else {
      setSavedPalettes((prev) => {
        const next = prev.map((p) =>
          p.id === paletteId
            ? { ...p, colors: st.colors, deletedColors: st.deletedColors, meshColorMode, meshLineColor, style: st.style }
            : p,
        );
        persistSavedPalettes(next);
        return next;
      });
    }
    setEdited(false);
  };

  // Próxima paleta visível (pra selecionar após deletar a ativa).
  const firstAvailableId = (excludeId: string): string => {
    const preset = PALETTES.find((p) => p.id !== excludeId && !deletedPresets.includes(p.id));
    if (preset) return preset.id;
    const saved = savedPalettes.find((p) => p.id !== excludeId);
    return saved?.id ?? 'convert';
  };

  // Deletar: paleta salvada → remove; preset embutido → oculta (deletedPresets)
  // e remove o override. Se era a ativa, seleciona a próxima disponível.
  const handleDeletePalette = (id: string) => {
    if (!window.confirm(`Deletar o estilo "${nameOf(id)}"?`)) return;
    if (builtinOf(id)) {
      setDeletedPresets((prev) => {
        const next = prev.includes(id) ? prev : [...prev, id];
        persistDeletedPresets(next);
        return next;
      });
      if (paletteOverrides[id]) {
        setPaletteOverrides((prev) => {
          const next = { ...prev };
          delete next[id];
          persistOverrides(next);
          return next;
        });
      }
    } else {
      setSavedPalettes((prev) => {
        const next = prev.filter((p) => p.id !== id);
        persistSavedPalettes(next);
        return next;
      });
    }
    if (paletteId === id) handlePaletteChange(firstAvailableId(id));
  };

  // Duplicar: cria uma nova paleta salvada com as cores ATUAIS na tela (rascunho).
  const handleDuplicatePalette = () => {
    const entry: SavedPalette = {
      id: newId(),
      name: `${nameOf(paletteId)} cópia`,
      colors: [...customColors] as PaletteColors,
      ...(deletedColors.length ? { deletedColors: [...deletedColors] } : {}),
      meshColorMode,
      meshLineColor,
      style: currentStyle(),
    };
    setSavedPalettes((prev) => {
      const next = [...prev, entry];
      persistSavedPalettes(next);
      return next;
    });
    setPaletteId(entry.id);
    setEdited(false);
  };

  // Renomear a paleta ativa: preset embutido → grava o nome no override (mantendo
  // as cores salvas atuais); paleta salvada → atualiza o nome in-place.
  const handleRenamePalette = () => {
    const name = window.prompt('Novo nome do estilo:', nameOf(paletteId));
    if (name === null) return;
    const clean = name.trim();
    if (!clean) return;
    if (builtinOf(paletteId)) {
      const st = savedStateOf(paletteId);
      setPaletteOverrides((prev) => {
        const next = {
          ...prev,
          [paletteId]: {
            colors: st.colors,
            deletedColors: st.deletedColors,
            meshColorMode: st.meshColorMode,
            meshLineColor: st.meshLineColor,
            style: st.style,
            name: clean,
          },
        };
        persistOverrides(next);
        return next;
      });
    } else {
      setSavedPalettes((prev) => {
        const next = prev.map((p) => (p.id === paletteId ? { ...p, name: clean } : p));
        persistSavedPalettes(next);
        return next;
      });
    }
  };

  // Restaurar padrão de fábrica: apaga o override do preset embutido ativo e
  // recarrega os defaults embutidos. Só faz sentido se houver override.
  const canResetPreset = !!builtinOf(paletteId) && !!paletteOverrides[paletteId];
  const handleResetPreset = () => {
    const b = builtinOf(paletteId);
    if (!b || !paletteOverrides[paletteId]) return;
    if (!window.confirm(`Restaurar "${nameOf(paletteId)}" ao padrão de fábrica? Isso apaga as edições salvas deste estilo.`)) return;
    setPaletteOverrides((prev) => {
      const next = { ...prev };
      delete next[paletteId];
      persistOverrides(next);
      return next;
    });
    setCustomColors(paletteColors(b));
    setDeletedColors(b.deletedColors ?? []);
    setMeshColorMode(MESH_MODE_DEFAULT);
    setMeshLineColor(MESH_LINE_DEFAULT);
    applyStyle(b.style ?? STYLE_DEFAULT);
    setEdited(false);
  };

  // Cores ativas (o rascunho atual) — usado no export do projeto.
  const effectiveColors = (): PaletteColors => [...customColors] as PaletteColors;

  // Exporta TODOS os parâmetros (formato, cores, forma, animação, mesh, anéis)
  // num .json. As cores ativas vão sempre como customColors snapshot.
  const handleExportProject = () => {
    const state: ProjectState = {
      width, height, videoQuality, videoFpsHeatmap, videoFpsMesh,
      paletteId, customColors: effectiveColors(), deletedColors,
      mode, blobCount, irregularity, warp, warpScale, blobSizeMin, blobSizeMax, blobSizeVar,
      blobAnchorX, blobAnchorY, blobFree, blobBordas,
      assetBands, assetWarp, assetCore, assetPresence, seed, grainHeatmap, grainMesh,
      speedHeatmap, speedMesh, morphAmpHeatmap, morphAmpMesh, meshFlow, meshFlowDir,
      drift, flowDensity, flowSize,
      spawnRate, spawnLife, spawnSize, spawnSizeVar,
      meshLevels, meshLineWidth, meshRelief, meshLineColor, meshColorMode,
      ring0Weight, ring0Fluidez, ring1Weight, ring1Fluidez, ring2Weight, ring2Fluidez,
      ring3Weight, ring3Fluidez, ring4Weight, ring4Fluidez, bordaWeight, bordaFluidez,
    };
    const blob = new Blob([serializeProject(state)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `convert_ID_GEN-${mode}-seed${seed}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const applyProject = (p: Partial<ProjectState>) => {
    // Honra o grão (heat map) importado: pula o auto-grão da próxima troca de resolução.
    const resChanges =
      (p.width !== undefined && p.width !== width) ||
      (p.height !== undefined && p.height !== height);
    if (resChanges && p.grainHeatmap !== undefined) skipGrainAutoRef.current = true;
    if (resChanges && p.meshLineWidth !== undefined) skipMeshWidthAutoRef.current = true;

    if (p.width !== undefined) setWidth(p.width);
    if (p.height !== undefined) setHeight(p.height);
    if (p.videoQuality !== undefined) setVideoQuality(p.videoQuality);
    if (p.videoFpsHeatmap !== undefined) setVideoFpsHeatmap(p.videoFpsHeatmap);
    if (p.videoFpsMesh !== undefined) setVideoFpsMesh(p.videoFpsMesh);
    if (p.mode !== undefined) setMode(p.mode);
    if (p.blobCount !== undefined) setBlobCount(p.blobCount);
    if (p.irregularity !== undefined) setIrregularity(p.irregularity);
    if (p.warp !== undefined) setWarp(p.warp);
    if (p.warpScale !== undefined) setWarpScale(p.warpScale);
    if (p.blobSizeMin !== undefined) setBlobSizeMin(p.blobSizeMin);
    if (p.blobSizeMax !== undefined) setBlobSizeMax(p.blobSizeMax);
    if (p.blobSizeVar !== undefined) setBlobSizeVar(p.blobSizeVar);
    if (p.blobAnchorX !== undefined) setBlobAnchorX(p.blobAnchorX);
    if (p.blobAnchorY !== undefined) setBlobAnchorY(p.blobAnchorY);
    if (p.blobFree !== undefined) setBlobFree(p.blobFree);
    if (p.blobBordas !== undefined) setBlobBordas(p.blobBordas);
    if (p.assetBands !== undefined) setAssetBands(p.assetBands);
    if (p.assetWarp !== undefined) setAssetWarp(p.assetWarp);
    if (p.assetCore !== undefined) setAssetCore(p.assetCore);
    if (p.assetPresence !== undefined) setAssetPresence(p.assetPresence);
    if (p.seed !== undefined) setSeed(p.seed);
    if (p.grainHeatmap !== undefined) setGrainHeatmap(p.grainHeatmap);
    if (p.grainMesh !== undefined) setGrainMesh(p.grainMesh);
    if (p.speedHeatmap !== undefined) setSpeedHeatmap(p.speedHeatmap);
    if (p.speedMesh !== undefined) setSpeedMesh(p.speedMesh);
    if (p.morphAmpHeatmap !== undefined) setMorphAmpHeatmap(p.morphAmpHeatmap);
    if (p.morphAmpMesh !== undefined) setMorphAmpMesh(p.morphAmpMesh);
    if (p.meshFlow !== undefined) setMeshFlow(p.meshFlow);
    if (p.meshFlowDir !== undefined) setMeshFlowDir(p.meshFlowDir);
    if (p.drift !== undefined) setDrift(p.drift);
    if (p.flowDensity !== undefined) setFlowDensity(p.flowDensity);
    if (p.flowSize !== undefined) setFlowSize(p.flowSize);
    if (p.spawnRate !== undefined) setSpawnRate(p.spawnRate);
    if (p.spawnLife !== undefined) setSpawnLife(p.spawnLife);
    if (p.spawnSize !== undefined) setSpawnSize(p.spawnSize);
    if (p.spawnSizeVar !== undefined) setSpawnSizeVar(p.spawnSizeVar);
    if (p.meshLevels !== undefined) setMeshLevels(p.meshLevels);
    if (p.meshLineWidth !== undefined) setMeshLineWidth(p.meshLineWidth);
    if (p.meshRelief !== undefined) setMeshRelief(p.meshRelief);
    if (p.meshLineColor !== undefined) setMeshLineColor(p.meshLineColor);
    if (p.meshColorMode !== undefined) setMeshColorMode(p.meshColorMode);
    if (p.ring0Weight !== undefined) setRing0Weight(p.ring0Weight);
    if (p.ring0Fluidez !== undefined) setRing0Fluidez(p.ring0Fluidez);
    if (p.ring1Weight !== undefined) setRing1Weight(p.ring1Weight);
    if (p.ring1Fluidez !== undefined) setRing1Fluidez(p.ring1Fluidez);
    if (p.ring2Weight !== undefined) setRing2Weight(p.ring2Weight);
    if (p.ring2Fluidez !== undefined) setRing2Fluidez(p.ring2Fluidez);
    if (p.ring3Weight !== undefined) setRing3Weight(p.ring3Weight);
    if (p.ring3Fluidez !== undefined) setRing3Fluidez(p.ring3Fluidez);
    if (p.ring4Weight !== undefined) setRing4Weight(p.ring4Weight);
    if (p.ring4Fluidez !== undefined) setRing4Fluidez(p.ring4Fluidez);
    if (p.bordaWeight !== undefined) setBordaWeight(p.bordaWeight);
    if (p.bordaFluidez !== undefined) setBordaFluidez(p.bordaFluidez);

    // Cores/paleta por último: aplica o id se conhecido e as cores importadas como
    // edição NÃO salva (rascunho) sobre essa paleta — preserva o look do arquivo.
    if (p.paletteId !== undefined) {
      const known =
        PALETTES.some((pl) => pl.id === p.paletteId) ||
        savedPalettes.some((sp) => sp.id === p.paletteId);
      setPaletteId(known ? p.paletteId : 'convert');
    }
    if (p.customColors !== undefined) {
      setCustomColors(p.customColors);
      setEdited(true);
    }
    if (p.deletedColors !== undefined) setDeletedColors(p.deletedColors);
  };

  const handleImportClick = () => importInputRef.current?.click();

  const handleImportFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite reimportar o mesmo arquivo
    if (!file) return;
    setExportError(null);
    file
      .text()
      .then((text) => {
        const parsed = parseProject(text);
        if (Object.keys(parsed).length === 0) {
          throw new Error('JSON sem parâmetros válidos.');
        }
        applyProject(parsed);
      })
      .catch((err: unknown) => {
        console.error(err);
        setExportError(err instanceof Error ? err.message : 'Falha ao importar o JSON.');
      });
  };

  const controlsProps: ControlsProps = {
    width,
    height,
    paletteId,
    customColors,
    savedPalettes,
    paletteOverrides,
    deletedPresets,
    edited,
    mode,
    blobCount,
    irregularity,
    warp,
    warpScale,
    blobSizeMin,
    blobSizeMax,
    blobSizeVar,
    assetBands,
    assetWarp,
    assetCore,
    assetPresence,
    grain,
    seed,
    playing,
    speed,
    videoProgress,
    videoQuality,
    onVideoQualityChange: setVideoQuality,
    videoFps,
    onVideoFpsChange: handleVideoFpsChange,
    onExportVideo: handleExportVideo,
    onExportPreview: handleExportPreview,
    onCancelExport: handleCancelExport,
    morphAmp,
    meshFlow,
    meshFlowDir,
    drift,
    flowDensity,
    flowSize,
    spawnRate,
    spawnLife,
    spawnSize,
    spawnSizeVar,
    meshLevels,
    meshLineWidth,
    meshRelief,
    meshLineColor,
    meshColorMode,
    ring0Weight,
    ring0Fluidez,
    ring1Weight,
    ring1Fluidez,
    ring2Weight,
    ring2Fluidez,
    ring3Weight,
    ring3Fluidez,
    ring4Weight,
    ring4Fluidez,
    bordaWeight,
    bordaFluidez,
    onWidthChange: setWidth,
    onHeightChange: setHeight,
    onPaletteChange: handlePaletteChange,
    onCustomColorChange: handleCustomColorChange,
    onReorderColors: handleReorderColors,
    deletedColors,
    onDeleteColor: handleDeleteColor,
    onRestoreColor: handleRestoreColor,
    onSavePalette: handleSavePalette,
    onRevertPalette: handleRevertPalette,
    onDeletePalette: handleDeletePalette,
    onDuplicatePalette: handleDuplicatePalette,
    onRenamePalette: handleRenamePalette,
    canResetPreset,
    onResetPreset: handleResetPreset,
    onModeChange: setMode,
    onBlobCountChange: markEd(setBlobCount),
    onIrregularityChange: markEd(setIrregularity),
    onWarpChange: markEd(setWarp),
    onWarpScaleChange: markEd(setWarpScale),
    onBlobSizeMinChange: handleBlobSizeMin,
    onBlobSizeMaxChange: handleBlobSizeMax,
    onBlobSizeVarChange: markEd(setBlobSizeVar),
    onAssetBandsChange: setAssetBands,
    onAssetWarpChange: setAssetWarp,
    onAssetCoreChange: setAssetCore,
    onAssetPresenceChange: handleAssetPresence,
    onGrainChange: handleGrainChange,
    onPlayingChange: setPlaying,
    onSpeedChange: handleSpeedChange,
    onMorphAmpChange: handleMorphAmpChange,
    onMeshFlowChange: setMeshFlow,
    onMeshFlowDirChange: setMeshFlowDir,
    onDriftChange: setDrift,
    onFlowDensityChange: setFlowDensity,
    onFlowSizeChange: setFlowSize,
    onSpawnRateChange: setSpawnRate,
    onSpawnLifeChange: setSpawnLife,
    onSpawnSizeChange: setSpawnSize,
    onSpawnSizeVarChange: setSpawnSizeVar,
    onMeshLevelsChange: setMeshLevels,
    onMeshLineWidthChange: setMeshLineWidth,
    onMeshReliefChange: setMeshRelief,
    onMeshLineColorChange: handleMeshLineColorChange,
    onMeshColorModeChange: handleMeshColorModeChange,
    onRing0WeightChange: handleRing0Weight,
    onRing0FluidezChange: markEd(setRing0Fluidez),
    onRing1WeightChange: handleRing1Weight,
    onRing1FluidezChange: markEd(setRing1Fluidez),
    onRing2WeightChange: handleRing2Weight,
    onRing2FluidezChange: markEd(setRing2Fluidez),
    onRing3WeightChange: handleRing3Weight,
    onRing3FluidezChange: markEd(setRing3Fluidez),
    onRing4WeightChange: handleRing4Weight,
    onRing4FluidezChange: markEd(setRing4Fluidez),
    onBordaWeightChange: handleBordaWeight,
    onBordaFluidezChange: markEd(setBordaFluidez),
    onRandomize: handleRandomize,
    onDownload: handleDownload,
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="wm">convert_<b>ID_GEN</b></div>
          <div className="tag">GENERATIVE ID ENGINE</div>
        </div>
        <div className="strip">
          <div className="cell"><span className="k">MODO</span><span className="v">{mode === 'mesh' ? 'MESH' : mode === 'asset' ? 'ASSET' : 'HEAT MAP'}</span></div>
          <div className="cell"><span className="k">SEED</span><span className="v">{seed}</span></div>
          <div className="cell"><span className="k">RESOLUÇÃO</span><span className="v">{renderW}×{renderH}<span className="unit">px</span></span></div>
          <div className="cell"><span className="k">BLOBS</span><span className="v">{blobCount}</span></div>
          <div className="cell"><span className="k">GRÃO</span><span className="v">{grain.toFixed(2)}</span></div>
          <div className="cell"><span className="k">FPS</span><span className="v">{videoFps}</span></div>
          {mode !== 'asset' && (
            <div className="topbar-anchor" title="Onde os blobs aparecem no canvas (mantém aleatoriedade)">
              <span className="k">POSIÇÃO</span>
              <div className="anchor-grid">
                {[0.25, 0.5, 0.75].map((ay) =>
                  [0.25, 0.5, 0.75].map((ax) => (
                    <button
                      key={`${ax}-${ay}`}
                      className={'acell' + (!blobFree && !blobBordas && blobAnchorX === ax && blobAnchorY === ay ? ' on' : '')}
                      onClick={() => { setBlobFree(false); setBlobBordas(false); setBlobAnchorX(ax); setBlobAnchorY(ay); }}
                      aria-label="posição dos blobs"
                    />
                  )),
                )}
              </div>
              <button
                className={'anchor-free' + (blobFree ? ' on' : '')}
                onClick={() => { setBlobFree(true); setBlobBordas(false); }}
                title="Aleatório total no canvas inteiro (sem posição definida)"
              >Livre</button>
              <button
                className={'anchor-free' + (blobBordas ? ' on' : '')}
                onClick={() => { setBlobBordas(true); setBlobFree(false); }}
                title="Blobs nas bordas (centro fora do canvas) vazando levemente pra dentro"
              >Bordas</button>
            </div>
          )}
          <div className="topbar-io">
            <button onClick={handleExportProject} title="Baixar todos os parâmetros (cores, anéis, animação…) em .json">⬇ Exportar</button>
            <button onClick={handleImportClick} title="Carregar parâmetros de um .json">⬆ Importar</button>
          </div>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={handleImportFile}
          />
          <div className="topbar-zoom">
            <button className={zoom === 'fit' ? 'on' : ''} onClick={() => setZoom('fit')}>Fit</button>
            <button className={zoom === '100' ? 'on' : ''} onClick={() => setZoom('100')}>100%</button>
          </div>
          <div className="right">
            <span className="statline"><span className="led" />RENDER&nbsp;OK</span>
            <span className="statline"><span className={'led' + (playing ? ' mag' : ' off')} />LIVE</span>
          </div>
        </div>
      </header>

      <ImagemPanel {...controlsProps} />

      <main className="stage">
        {exportError && <p className="export-error">{exportError}</p>}
        <Preview params={params} zoom={zoom} playing={playing} speed={speed} />
      </main>

      <VideoPanel {...controlsProps} />

      <ColorRingsDock {...controlsProps} />
    </div>
  );
}
