import { useMemo, useState } from 'react';
import { Controls } from './components/Controls';
import { Preview } from './components/Preview';
import { PALETTES, buildCustomPalette } from './data/palettes';
import { generateComposition } from './renderer/composition';
import { exportPNG } from './renderer/export';
import type { RenderParams } from './types';

export default function App() {
  const [width, setWidth] = useState(1920);
  const [height, setHeight] = useState(1080);
  const [paletteId, setPaletteId] = useState('nightfall');
  const [customColors, setCustomColors] = useState<
    [string, string, string, string, string]
  >(['#1a0d3d', '#ff7a4d', '#ec4899', '#6b46c1', '#1a0d3d']);
  const [blobCount, setBlobCount] = useState(5);
  const [irregularity, setIrregularity] = useState(0.4);
  const [grain, setGrain] = useState(0.6);
  // Centro / Anel 1 / Anel 2 sliders now represent SIZE (each one is the
  // outer extent of its ring in canvas space). Nesting is enforced at
  // render time — centro is clamped to anel 1's size, anel 1 to anel 2's.
  const [centroWeight, setCentroWeight] = useState(0.20);
  const [centroFluidez, setCentroFluidez] = useState(0.25);
  const [anel1Weight, setAnel1Weight] = useState(0.45);
  const [anel1Fluidez, setAnel1Fluidez] = useState(0.25);
  const [anel2Weight, setAnel2Weight] = useState(0.70);
  const [anel2Fluidez, setAnel2Fluidez] = useState(0.25);
  const [seed, setSeed] = useState(1);
  const [exportError, setExportError] = useState<string | null>(null);

  const palette = useMemo(() => {
    if (paletteId === 'custom') return buildCustomPalette(customColors);
    return PALETTES.find((p) => p.id === paletteId) ?? PALETTES[0];
  }, [paletteId, customColors]);

  const composition = useMemo(
    () => generateComposition(seed, blobCount, palette),
    [seed, blobCount, palette],
  );

  const params: RenderParams = {
    width,
    height,
    palette,
    composition,
    grain,
    irregularity,
    centroFluidez,
    anel1Fluidez,
    anel2Fluidez,
    centroWeight,
    anel1Weight,
    anel2Weight,
  };

  const handleCustomColorChange = (idx: number, color: string) => {
    setCustomColors((prev) => {
      const next = [...prev] as [string, string, string, string, string];
      next[idx] = color;
      return next;
    });
  };

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

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#050507' }}>
      <Controls
        width={width}
        height={height}
        paletteId={paletteId}
        customColors={customColors}
        blobCount={blobCount}
        irregularity={irregularity}
        grain={grain}
        centroWeight={centroWeight}
        centroFluidez={centroFluidez}
        anel1Weight={anel1Weight}
        anel1Fluidez={anel1Fluidez}
        anel2Weight={anel2Weight}
        anel2Fluidez={anel2Fluidez}
        onWidthChange={setWidth}
        onHeightChange={setHeight}
        onPaletteChange={setPaletteId}
        onCustomColorChange={handleCustomColorChange}
        onBlobCountChange={setBlobCount}
        onIrregularityChange={setIrregularity}
        onGrainChange={setGrain}
        onCentroWeightChange={setCentroWeight}
        onCentroFluidezChange={setCentroFluidez}
        onAnel1WeightChange={setAnel1Weight}
        onAnel1FluidezChange={setAnel1Fluidez}
        onAnel2WeightChange={setAnel2Weight}
        onAnel2FluidezChange={setAnel2Fluidez}
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
