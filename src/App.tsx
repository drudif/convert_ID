import { useMemo, useState } from 'react';
import { Controls } from './components/Controls';
import { Preview } from './components/Preview';
import { PALETTES } from './data/palettes';
import { generateComposition } from './renderer/composition';
import { exportPNG } from './renderer/export';
import type { RenderParams } from './types';

export default function App() {
  const [width, setWidth] = useState(1920);
  const [height, setHeight] = useState(1080);
  const [paletteId, setPaletteId] = useState('nightfall');
  const [blobCount, setBlobCount] = useState(3);
  const [grain, setGrain] = useState(0.6);
  const [blur, setBlur] = useState(120);
  const [seed, setSeed] = useState(1);
  const [exportError, setExportError] = useState<string | null>(null);

  const palette = useMemo(
    () => PALETTES.find((p) => p.id === paletteId) ?? PALETTES[0],
    [paletteId],
  );

  const composition = useMemo(
    () => generateComposition(seed, blobCount, palette, 0),
    [seed, blobCount, palette],
  );

  const params: RenderParams = {
    width,
    height,
    palette,
    composition,
    grain,
    blur,
    hardness: 0,
    irregularity: 0,
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
        blobCount={blobCount}
        grain={grain}
        blur={blur}
        onWidthChange={setWidth}
        onHeightChange={setHeight}
        onPaletteChange={setPaletteId}
        onBlobCountChange={setBlobCount}
        onGrainChange={setGrain}
        onBlurChange={setBlur}
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
