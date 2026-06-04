import { useEffect, useMemo, useState } from 'react';
import { ImagemPanel, VideoPanel, ColorRingsDock, type ControlsProps } from './components/Controls';
import { Preview, type Zoom } from './components/Preview';
import { PALETTES, buildCustomPalette } from './data/palettes';
import {
  loadSavedPalettes,
  persistSavedPalettes,
  savedToPalette,
  newId,
  type SavedPalette,
} from './data/savedPalettes';
import { generateComposition } from './renderer/composition';
import { exportPNG } from './renderer/export';
// NOTE: ./renderer/exportVideo (mp4-muxer + WebCodecs) is imported lazily inside
// handleExportVideo so the heavy/optional encoder never affects initial load.
import type { MeshColorMode, RenderMode, RenderParams } from './types';

export default function App() {
  const [width, setWidth] = useState(3840);
  const [height, setHeight] = useState(2160);
  const [paletteId, setPaletteId] = useState('custom');
  const [customColors, setCustomColors] = useState<
    [string, string, string, string, string, string, string]
  >(['#3a1c71', '#ff2ead', '#ff713a', '#9f75ff', '#4acbd6', '#3a1c71', '#3a1c71']);
  const [mode, setMode] = useState<RenderMode>('heatmap');
  const [blobCount, setBlobCount] = useState(5);
  const [irregularity, setIrregularity] = useState(1);
  // Animation. `playing`/`speed` drive the clock inside Preview; morph & flow
  // are static amounts fed into the render params (time is supplied per-frame).
  const [playing, setPlaying] = useState(false);
  // Speed is per render mode so each keeps its own default.
  const [speedHeatmap, setSpeedHeatmap] = useState(1);
  const [speedMesh, setSpeedMesh] = useState(0.9);
  const speed = mode === 'mesh' ? speedMesh : speedHeatmap;
  const handleSpeedChange = (s: number) =>
    (mode === 'mesh' ? setSpeedMesh : setSpeedHeatmap)(s);
  const [morphAmp, setMorphAmp] = useState(0.5);
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
  // Grain compensates for resolution (finer/less visible at 4K), so its default
  // tracks the output size: 0.17 at 4K, 0.13 at 1080. Still manually adjustable;
  // changing the Formato quality re-applies the resolution default (see effect).
  const [grain, setGrain] = useState(0.17);
  // Re-apply the resolution-appropriate grain whenever the output size changes.
  useEffect(() => {
    setGrain(Math.max(width, height) >= 3000 ? 0.17 : 0.13);
  }, [width, height]);
  // Mesh (topographic contour) mode params.
  const [meshLevels, setMeshLevels] = useState(28);
  const [meshLineWidth, setMeshLineWidth] = useState(1);
  const [meshRelief, setMeshRelief] = useState(0.6);
  const [meshLineColor, setMeshLineColor] = useState('#ec4899');
  const [meshColorMode, setMeshColorMode] = useState<MeshColorMode>('solid');
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
  const [seed, setSeed] = useState(1);
  const [exportError, setExportError] = useState<string | null>(null);
  const [videoProgress, setVideoProgress] = useState<{ done: number; total: number } | null>(null);
  const [zoom, setZoom] = useState<Zoom>('fit');
  const [savedPalettes, setSavedPalettes] = useState<SavedPalette[]>(() => loadSavedPalettes());

  const palette = useMemo(() => {
    if (paletteId === 'custom') return buildCustomPalette(customColors);
    const saved = savedPalettes.find((p) => p.id === paletteId);
    if (saved) return savedToPalette(saved);
    return PALETTES.find((p) => p.id === paletteId) ?? PALETTES[0];
  }, [paletteId, customColors, savedPalettes]);

  const composition = useMemo(
    () => generateComposition(seed, blobCount, palette),
    [seed, blobCount, palette],
  );

  const params: RenderParams = {
    width,
    height,
    palette,
    composition,
    mode,
    grain,
    irregularity,
    time: 0, // advanced per-frame inside Preview while playing
    morphAmp,
    meshFlow,
    meshFlowDir,
    drift, flowDensity, flowSize,
    spawnRate, spawnLife, spawnSize, spawnSizeVar,
    meshLevels, meshLineWidth, meshRelief, meshLineColor, meshColorMode,
    ring0Weight, ring0Fluidez,
    ring1Weight, ring1Fluidez,
    ring2Weight, ring2Fluidez,
    ring3Weight, ring3Fluidez,
    ring4Weight, ring4Fluidez,
    bordaWeight, bordaFluidez,
  };

  // Switching to Custom inherits the colours currently on screen (the active
  // preset/saved palette), so editing starts from what you were just seeing.
  const handlePaletteChange = (id: string) => {
    if (id === 'custom' && paletteId !== 'custom') {
      const bg = palette.background;
      const stops = palette.blobVariants[0].stops;
      const ring = (i: number) => (stops[i].alpha < 0.05 ? bg : stops[i].color);
      setCustomColors([bg, ring(0), ring(1), ring(2), ring(3), ring(4), ring(5)]);
    }
    setPaletteId(id);
  };

  const handleCustomColorChange = (idx: number, color: string) => {
    setCustomColors((prev) => {
      const next = [...prev] as [string, string, string, string, string, string, string];
      next[idx] = color;
      return next;
    });
  };

  // Ring size handlers — each one clamps the incoming value to the
  // current values of the predecessor and successor rings. The slider
  // itself stays static (0..1) so other sliders' tracks never change
  // when one is being edited; only the value being dragged is locked
  // when it reaches a neighbour.
  const clamp = (v: number, lo: number, hi: number) =>
    v < lo ? lo : v > hi ? hi : v;
  const handleRing0Weight = (v: number) => setRing0Weight(clamp(v, 0, ring1Weight));
  const handleRing1Weight = (v: number) => setRing1Weight(clamp(v, ring0Weight, ring2Weight));
  const handleRing2Weight = (v: number) => setRing2Weight(clamp(v, ring1Weight, ring3Weight));
  const handleRing3Weight = (v: number) => setRing3Weight(clamp(v, ring2Weight, ring4Weight));
  const handleRing4Weight = (v: number) => setRing4Weight(clamp(v, ring3Weight, bordaWeight));
  const handleBordaWeight = (v: number) => setBordaWeight(clamp(v, ring4Weight, 1));

  const handleRandomize = () => {
    setSeed(Math.floor(Math.random() * 2 ** 31));
  };

  const handleDownload = () => {
    setExportError(null);
    exportPNG(params).catch((err: unknown) => {
      console.error(err);
      setExportError(err instanceof Error ? err.message : 'Falha ao exportar.');
    });
  };

  const VIDEO_DURATION = 10;
  const VIDEO_FPS = 30;
  // preview = quick 480p pass to check before committing to a full 1080 render.
  const handleExport = async (preview: boolean) => {
    if (videoProgress) return; // already running
    setExportError(null);
    setPlaying(false); // free CPU for the offline render
    const long = preview ? 854 : 1920;
    const short = preview ? 480 : 1080;
    const vw = width > height ? long : short;          // landscape → long; portrait/square → short
    const vh = width < height ? long : short;          // portrait → long; landscape/square → short
    const bitrate = preview ? 2_500_000 : 8_000_000;
    // Grain follows the video's own resolution (≤1080 → 0.13), not the image's.
    const videoGrain = Math.max(vw, vh) >= 3000 ? 0.17 : 0.13;
    setVideoProgress({ done: 0, total: VIDEO_DURATION * VIDEO_FPS });
    try {
      const { exportMp4 } = await import('./renderer/exportVideo');
      const blob = await exportMp4(
        { ...params, grain: videoGrain }, vw, vh, VIDEO_DURATION, VIDEO_FPS,
        (done, total) => setVideoProgress({ done, total }),
        bitrate,
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `convert_ID_GEN-${mode}-${seed}-${vw}x${vh}${preview ? '-preview' : ''}.mp4`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setExportError(err instanceof Error ? err.message : 'Falha ao exportar o vídeo.');
    } finally {
      setVideoProgress(null);
    }
  };
  const handleExportVideo = () => handleExport(false);
  const handleExportPreview = () => handleExport(true);

  const handleSavePalette = () => {
    const name = window.prompt('Nome da paleta:');
    if (name === null) return;
    const entry: SavedPalette = {
      id: newId(),
      name: name.trim() || 'Sem nome',
      colors: customColors,
    };
    setSavedPalettes((prev) => {
      const next = [...prev, entry];
      persistSavedPalettes(next);
      return next;
    });
    setPaletteId(entry.id);
  };

  const handleDeletePalette = (id: string) => {
    setSavedPalettes((prev) => {
      const next = prev.filter((p) => p.id !== id);
      persistSavedPalettes(next);
      return next;
    });
    if (paletteId === id) setPaletteId('nightfall');
  };

  const controlsProps: ControlsProps = {
    width,
    height,
    paletteId,
    customColors,
    savedPalettes,
    mode,
    blobCount,
    irregularity,
    grain,
    seed,
    playing,
    speed,
    videoProgress,
    onExportVideo: handleExportVideo,
    onExportPreview: handleExportPreview,
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
    onSavePalette: handleSavePalette,
    onDeletePalette: handleDeletePalette,
    onModeChange: setMode,
    onBlobCountChange: setBlobCount,
    onIrregularityChange: setIrregularity,
    onGrainChange: setGrain,
    onPlayingChange: setPlaying,
    onSpeedChange: handleSpeedChange,
    onMorphAmpChange: setMorphAmp,
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
    onMeshLineColorChange: setMeshLineColor,
    onMeshColorModeChange: setMeshColorMode,
    onRing0WeightChange: handleRing0Weight,
    onRing0FluidezChange: setRing0Fluidez,
    onRing1WeightChange: handleRing1Weight,
    onRing1FluidezChange: setRing1Fluidez,
    onRing2WeightChange: handleRing2Weight,
    onRing2FluidezChange: setRing2Fluidez,
    onRing3WeightChange: handleRing3Weight,
    onRing3FluidezChange: setRing3Fluidez,
    onRing4WeightChange: handleRing4Weight,
    onRing4FluidezChange: setRing4Fluidez,
    onBordaWeightChange: handleBordaWeight,
    onBordaFluidezChange: setBordaFluidez,
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
          <div className="cell"><span className="k">MODO</span><span className="v">{mode === 'mesh' ? 'MESH' : 'HEAT MAP'}</span></div>
          <div className="cell"><span className="k">SEED</span><span className="v">{seed}</span></div>
          <div className="cell"><span className="k">RESOLUÇÃO</span><span className="v">{width}×{height}<span className="unit">px</span></span></div>
          <div className="cell"><span className="k">BLOBS</span><span className="v">{blobCount}</span></div>
          <div className="cell"><span className="k">GRÃO</span><span className="v">{grain.toFixed(2)}</span></div>
          <div className="cell"><span className="k">FPS</span><span className="v">{VIDEO_FPS}</span></div>
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
