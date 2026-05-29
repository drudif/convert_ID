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

  const palette = useMemo(
    () => PALETTES.find((p) => p.id === paletteId) ?? PALETTES[0],
    [paletteId],
  );

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
  };

  const handleRandomize = () => {
    setSeed(Math.floor(Math.random() * 2 ** 31));
  };

  const handleDownload = () => {
    exportPNG(params).catch((err) => {
      console.error(err);
      alert(err.message ?? 'Falha ao exportar.');
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
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        overflow: 'hidden',
      }}>
        <Preview params={params} />
      </main>
    </div>
  );
}
