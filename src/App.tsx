import { useMemo, useState } from 'react';
import { Controls } from './components/Controls';
import { Preview } from './components/Preview';
import { PALETTES, buildCustomPalette } from './data/palettes';
import {
  loadSavedPalettes,
  persistSavedPalettes,
  savedToPalette,
  serializePalettes,
  parsePalettesFile,
  newId,
  type SavedPalette,
} from './data/savedPalettes';
import { generateComposition } from './renderer/composition';
import { exportPNG } from './renderer/export';
import type { MeshColorMode, RenderMode, RenderParams } from './types';

export default function App() {
  const [width, setWidth] = useState(1920);
  const [height, setHeight] = useState(1080);
  const [paletteId, setPaletteId] = useState('nightfall');
  const [customColors, setCustomColors] = useState<
    [string, string, string, string, string, string, string]
  >(['#1a0d3d', '#ffd479', '#ff7a4d', '#ec4899', '#6b46c1', '#3a1d6d', '#1a0d3d']);
  const [mode, setMode] = useState<RenderMode>('heatmap');
  const [blobCount, setBlobCount] = useState(5);
  const [irregularity, setIrregularity] = useState(0.4);
  // Grain is tracked per render mode so each keeps its own default and any
  // manual tweak survives toggling between Heat map and Mesh.
  const [grainHeatmap, setGrainHeatmap] = useState(0.25);
  const [grainMesh, setGrainMesh] = useState(0.2);
  const grain = mode === 'mesh' ? grainMesh : grainHeatmap;
  const handleGrainChange = (g: number) =>
    (mode === 'mesh' ? setGrainMesh : setGrainHeatmap)(g);
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
    meshLevels, meshLineWidth, meshRelief, meshLineColor, meshColorMode,
    ring0Weight, ring0Fluidez,
    ring1Weight, ring1Fluidez,
    ring2Weight, ring2Fluidez,
    ring3Weight, ring3Fluidez,
    ring4Weight, ring4Fluidez,
    bordaWeight, bordaFluidez,
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

  const handleExportPalettes = () => {
    const blob = new Blob([serializePalettes(savedPalettes)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'convert_ID_GEN-paletas.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportPalettes = (file: File) => {
    file.text().then((text) => {
      try {
        const imported = parsePalettesFile(text);
        if (!imported.length) {
          window.alert('Nenhuma paleta válida encontrada no arquivo.');
          return;
        }
        setSavedPalettes((prev) => {
          const byId = new Map(prev.map((p) => [p.id, p]));
          for (const p of imported) byId.set(p.id, p);
          const next = [...byId.values()];
          persistSavedPalettes(next);
          return next;
        });
      } catch {
        window.alert('Arquivo de paletas inválido.');
      }
    });
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#050507' }}>
      <Controls
        width={width}
        height={height}
        paletteId={paletteId}
        customColors={customColors}
        savedPalettes={savedPalettes}
        mode={mode}
        blobCount={blobCount}
        irregularity={irregularity}
        grain={grain}
        meshLevels={meshLevels}
        meshLineWidth={meshLineWidth}
        meshRelief={meshRelief}
        meshLineColor={meshLineColor}
        meshColorMode={meshColorMode}
        ring0Weight={ring0Weight}
        ring0Fluidez={ring0Fluidez}
        ring1Weight={ring1Weight}
        ring1Fluidez={ring1Fluidez}
        ring2Weight={ring2Weight}
        ring2Fluidez={ring2Fluidez}
        ring3Weight={ring3Weight}
        ring3Fluidez={ring3Fluidez}
        ring4Weight={ring4Weight}
        ring4Fluidez={ring4Fluidez}
        bordaWeight={bordaWeight}
        bordaFluidez={bordaFluidez}
        onWidthChange={setWidth}
        onHeightChange={setHeight}
        onPaletteChange={setPaletteId}
        onCustomColorChange={handleCustomColorChange}
        onSavePalette={handleSavePalette}
        onDeletePalette={handleDeletePalette}
        onExportPalettes={handleExportPalettes}
        onImportPalettes={handleImportPalettes}
        onModeChange={setMode}
        onBlobCountChange={setBlobCount}
        onIrregularityChange={setIrregularity}
        onGrainChange={handleGrainChange}
        onMeshLevelsChange={setMeshLevels}
        onMeshLineWidthChange={setMeshLineWidth}
        onMeshReliefChange={setMeshRelief}
        onMeshLineColorChange={setMeshLineColor}
        onMeshColorModeChange={setMeshColorMode}
        onRing0WeightChange={handleRing0Weight}
        onRing0FluidezChange={setRing0Fluidez}
        onRing1WeightChange={handleRing1Weight}
        onRing1FluidezChange={setRing1Fluidez}
        onRing2WeightChange={handleRing2Weight}
        onRing2FluidezChange={setRing2Fluidez}
        onRing3WeightChange={handleRing3Weight}
        onRing3FluidezChange={setRing3Fluidez}
        onRing4WeightChange={handleRing4Weight}
        onRing4FluidezChange={setRing4Fluidez}
        onBordaWeightChange={handleBordaWeight}
        onBordaFluidezChange={setBordaFluidez}
        onRandomize={handleRandomize}
        onDownload={handleDownload}
      />
      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        overflow: 'hidden',
        gap: 12,
      }}>
        {exportError && (
          <p style={{
            color: '#fca5a5',
            background: 'rgba(220, 38, 38, 0.15)',
            border: '1px solid rgba(220, 38, 38, 0.4)',
            padding: '8px 12px',
            borderRadius: 4,
            margin: 0,
            fontSize: 13,
          }}>
            {exportError}
          </p>
        )}
        <Preview params={params} />
      </main>
    </div>
  );
}
