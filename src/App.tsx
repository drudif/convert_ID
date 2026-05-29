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
  const [blobCount, setBlobCount] = useState(3);
  const [irregularity, setIrregularity] = useState(0);
  const [grain, setGrain] = useState(0.6);
  const [blur, setBlur] = useState(120);
  const [fluidez, setFluidez] = useState(0);
  const [centroWeight, setCentroWeight] = useState(0.33);
  const [anel1Weight, setAnel1Weight] = useState(0.33);
  const [anel2Weight, setAnel2Weight] = useState(0.34);
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
    blur,
    irregularity,
    fluidez,
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
        blur={blur}
        fluidez={fluidez}
        centroWeight={centroWeight}
        anel1Weight={anel1Weight}
        anel2Weight={anel2Weight}
        onWidthChange={setWidth}
        onHeightChange={setHeight}
        onPaletteChange={setPaletteId}
        onCustomColorChange={handleCustomColorChange}
        onBlobCountChange={setBlobCount}
        onIrregularityChange={setIrregularity}
        onGrainChange={setGrain}
        onBlurChange={setBlur}
        onFluidezChange={setFluidez}
        onCentroWeightChange={setCentroWeight}
        onAnel1WeightChange={setAnel1Weight}
        onAnel2WeightChange={setAnel2Weight}
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
