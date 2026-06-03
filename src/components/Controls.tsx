import { useRef } from 'react';
import type { MeshColorMode, Palette, RenderMode } from '../types';
import { PALETTES } from '../data/palettes';
import type { SavedPalette } from '../data/savedPalettes';

const MAX_DIM = 3840;

const RESOLUTION_PRESETS: Array<{ label: string; w: number; h: number }> = [
  { label: '1080p',     w: 1920, h: 1080 },
  { label: '4K',        w: 3840, h: 2160 },
  { label: 'Quadrado',  w: 3840, h: 3840 },
  { label: 'Vertical',  w: 2160, h: 3840 },
];

type Props = {
  width: number;
  height: number;
  paletteId: string;
  customColors: [string, string, string, string, string, string, string];
  savedPalettes: SavedPalette[];
  mode: RenderMode;
  blobCount: number;
  irregularity: number;
  grain: number;
  meshLevels: number;
  meshLineWidth: number;
  meshRelief: number;
  meshLineColor: string;
  meshColorMode: MeshColorMode;
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
  onWidthChange: (w: number) => void;
  onHeightChange: (h: number) => void;
  onPaletteChange: (id: string) => void;
  onCustomColorChange: (idx: number, color: string) => void;
  onSavePalette: () => void;
  onDeletePalette: (id: string) => void;
  onExportPalettes: () => void;
  onImportPalettes: (file: File) => void;
  onModeChange: (m: RenderMode) => void;
  onBlobCountChange: (n: number) => void;
  onIrregularityChange: (i: number) => void;
  onGrainChange: (g: number) => void;
  onMeshLevelsChange: (n: number) => void;
  onMeshLineWidthChange: (w: number) => void;
  onMeshReliefChange: (r: number) => void;
  onMeshLineColorChange: (c: string) => void;
  onMeshColorModeChange: (m: MeshColorMode) => void;
  onRing0WeightChange: (w: number) => void;
  onRing0FluidezChange: (f: number) => void;
  onRing1WeightChange: (w: number) => void;
  onRing1FluidezChange: (f: number) => void;
  onRing2WeightChange: (w: number) => void;
  onRing2FluidezChange: (f: number) => void;
  onRing3WeightChange: (w: number) => void;
  onRing3FluidezChange: (f: number) => void;
  onRing4WeightChange: (w: number) => void;
  onRing4FluidezChange: (f: number) => void;
  onBordaWeightChange: (w: number) => void;
  onBordaFluidezChange: (f: number) => void;
  onRandomize: () => void;
  onDownload: () => void;
};

function clampDim(n: number): number {
  if (!Number.isFinite(n) || n < 1) return 1;
  if (n > MAX_DIM) return MAX_DIM;
  return Math.round(n);
}

function ringColorsFor(
  paletteId: string,
  customColors: string[],
  savedPalettes: SavedPalette[],
): { fundo: string; rings: string[] } {
  if (paletteId === 'custom') {
    // customColors = [Fundo, º0, º1, º2, º3, º4, Borda]
    return { fundo: customColors[0], rings: customColors.slice(1) };
  }
  const saved = savedPalettes.find((p) => p.id === paletteId);
  if (saved) return { fundo: saved.colors[0], rings: saved.colors.slice(1) };
  const palette = PALETTES.find((p) => p.id === paletteId);
  if (!palette) return { fundo: customColors[0], rings: customColors.slice(1) };
  const bg = palette.background;
  const stops = palette.blobVariants[0].stops;
  const rings = stops.map((s) => (s.alpha < 0.05 ? bg : s.color));
  return { fundo: bg, rings };
}

export function Controls(props: Props) {
  const isCustom = props.paletteId === 'custom';
  const colors = ringColorsFor(props.paletteId, props.customColors, props.savedPalettes);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <aside style={{
      width: 320,
      padding: 20,
      background: '#0f0f12',
      color: '#e5e5e5',
      borderRight: '1px solid #222',
      overflowY: 'auto',
      fontFamily: 'system-ui, sans-serif',
      fontSize: 13,
    }}>
      <h1 style={{ fontSize: 18, margin: '0 0 20px' }}>convert_ID_GEN</h1>

      <section style={{ marginBottom: 24 }}>
        <label style={labelStyle}>Modo</label>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => props.onModeChange('heatmap')}
            style={chipStyle(props.mode === 'heatmap')}
          >
            Heat map
          </button>
          <button
            onClick={() => props.onModeChange('mesh')}
            style={chipStyle(props.mode === 'mesh')}
          >
            Mesh
          </button>
        </div>
      </section>

      <section style={{ marginBottom: 24 }}>
        <label style={labelStyle}>Resolução</label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input
            type="number"
            min={1}
            max={MAX_DIM}
            value={props.width}
            onChange={(e) => props.onWidthChange(clampDim(Number(e.target.value)))}
            style={inputStyle}
          />
          <span style={{ alignSelf: 'center' }}>×</span>
          <input
            type="number"
            min={1}
            max={MAX_DIM}
            value={props.height}
            onChange={(e) => props.onHeightChange(clampDim(Number(e.target.value)))}
            style={inputStyle}
          />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {RESOLUTION_PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => { props.onWidthChange(p.w); props.onHeightChange(p.h); }}
              style={chipStyle(props.width === p.w && props.height === p.h)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: 24 }}>
        <label style={labelStyle}>Paleta</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {PALETTES.map((p: Palette) => (
            <button
              key={p.id}
              onClick={() => props.onPaletteChange(p.id)}
              style={chipStyle(props.paletteId === p.id)}
            >
              {p.name}
            </button>
          ))}
          <button
            key="custom"
            onClick={() => props.onPaletteChange('custom')}
            style={chipStyle(props.paletteId === 'custom')}
          >
            Custom
          </button>
          {props.savedPalettes.map((sp) => {
            const active = props.paletteId === sp.id;
            return (
              <span key={sp.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, ...chipStyle(active) }}>
                <button
                  onClick={() => props.onPaletteChange(sp.id)}
                  style={{ all: 'unset', cursor: 'pointer' }}
                >
                  {sp.name}
                </button>
                <button
                  onClick={() => props.onDeletePalette(sp.id)}
                  title="Apagar paleta"
                  style={{ all: 'unset', cursor: 'pointer', opacity: 0.6, fontWeight: 700, lineHeight: 1 }}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {isCustom && (
            <button onClick={props.onSavePalette} style={chipStyle(false)}>
              💾 Salvar paleta
            </button>
          )}
          <button
            onClick={props.onExportPalettes}
            disabled={!props.savedPalettes.length}
            style={{ ...chipStyle(false), opacity: props.savedPalettes.length ? 1 : 0.4 }}
          >
            ⬆ Exportar
          </button>
          <button onClick={() => fileInputRef.current?.click()} style={chipStyle(false)}>
            ⬇ Importar
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) props.onImportPalettes(f);
              e.target.value = '';
            }}
          />
        </div>

        <div style={{ marginTop: 12 }}>
          {isCustom ? (
            <ColorRow
              label="Fundo"
              color={colors.fundo}
              onChange={(c) => props.onCustomColorChange(0, c)}
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ ...labelStyle, marginBottom: 0, flex: 1 }}>Fundo</label>
              <span style={hexStyle}>{colors.fundo}</span>
              <span
                style={{ ...colorSwatchStyle, background: colors.fundo, cursor: 'default' }}
                aria-hidden
              />
            </div>
          )}
        </div>
      </section>

      <Slider
        label="Nº de blobs"
        min={1}
        max={8}
        step={1}
        value={props.blobCount}
        onChange={props.onBlobCountChange}
      />
      <Slider
        label="Irregularidade"
        min={0}
        max={1}
        step={0.01}
        value={props.irregularity}
        onChange={props.onIrregularityChange}
      />
      <Slider
        label="Grão"
        min={0}
        max={1}
        step={0.01}
        value={props.grain}
        onChange={props.onGrainChange}
      />

      {props.mode === 'mesh' && (
        <>
          <Slider
            label="Densidade de linhas"
            min={4}
            max={80}
            step={1}
            value={props.meshLevels}
            onChange={props.onMeshLevelsChange}
          />
          <Slider
            label="Espessura"
            min={0.4}
            max={3}
            step={0.1}
            value={props.meshLineWidth}
            onChange={props.onMeshLineWidthChange}
          />
          <Slider
            label="Relevo extra"
            min={0}
            max={1.5}
            step={0.01}
            value={props.meshRelief}
            onChange={props.onMeshReliefChange}
          />
          <section style={{ marginTop: 8 }}>
            <label style={labelStyle}>Cor da linha</label>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <button
                onClick={() => props.onMeshColorModeChange('solid')}
                style={chipStyle(props.meshColorMode === 'solid')}
              >
                Sólida
              </button>
              <button
                onClick={() => props.onMeshColorModeChange('palette')}
                style={chipStyle(props.meshColorMode === 'palette')}
              >
                Seguir paleta
              </button>
            </div>
            {props.meshColorMode === 'solid' && (
              <ColorRow
                label="Cor"
                color={props.meshLineColor}
                onChange={props.onMeshLineColorChange}
              />
            )}
          </section>
        </>
      )}

      {props.mode === 'heatmap' && (<>
      <RingBlock
        label="º0"
        isCustom={isCustom}
        color={colors.rings[0]}
        onColorChange={(c) => props.onCustomColorChange(1, c)}
        weight={props.ring0Weight}
        fluidez={props.ring0Fluidez}
        onWeightChange={props.onRing0WeightChange}
        onFluidezChange={props.onRing0FluidezChange}
      />
      <RingBlock
        label="º1"
        isCustom={isCustom}
        color={colors.rings[1]}
        onColorChange={(c) => props.onCustomColorChange(2, c)}
        weight={props.ring1Weight}
        fluidez={props.ring1Fluidez}
        onWeightChange={props.onRing1WeightChange}
        onFluidezChange={props.onRing1FluidezChange}
      />
      <RingBlock
        label="º2"
        isCustom={isCustom}
        color={colors.rings[2]}
        onColorChange={(c) => props.onCustomColorChange(3, c)}
        weight={props.ring2Weight}
        fluidez={props.ring2Fluidez}
        onWeightChange={props.onRing2WeightChange}
        onFluidezChange={props.onRing2FluidezChange}
      />
      <RingBlock
        label="º3"
        isCustom={isCustom}
        color={colors.rings[3]}
        onColorChange={(c) => props.onCustomColorChange(4, c)}
        weight={props.ring3Weight}
        fluidez={props.ring3Fluidez}
        onWeightChange={props.onRing3WeightChange}
        onFluidezChange={props.onRing3FluidezChange}
      />
      <RingBlock
        label="º4"
        isCustom={isCustom}
        color={colors.rings[4]}
        onColorChange={(c) => props.onCustomColorChange(5, c)}
        weight={props.ring4Weight}
        fluidez={props.ring4Fluidez}
        onWeightChange={props.onRing4WeightChange}
        onFluidezChange={props.onRing4FluidezChange}
      />
      <RingBlock
        label="Borda"
        isCustom={isCustom}
        color={colors.rings[5]}
        onColorChange={(c) => props.onCustomColorChange(6, c)}
        weight={props.bordaWeight}
        fluidez={props.bordaFluidez}
        onWeightChange={props.onBordaWeightChange}
        onFluidezChange={props.onBordaFluidezChange}
      />
      </>)}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 24 }}>
        <button onClick={props.onRandomize} style={buttonStyle}>↻ Randomize</button>
        <button onClick={props.onDownload} style={{ ...buttonStyle, background: '#6b46c1' }}>
          ⬇ Baixar PNG
        </button>
      </div>
    </aside>
  );
}

function RingBlock(props: {
  label: string;
  isCustom: boolean;
  color: string;
  onColorChange: (c: string) => void;
  weight: number;
  fluidez: number;
  onWeightChange: (w: number) => void;
  onFluidezChange: (f: number) => void;
}) {
  return (
    <section style={ringBlockStyle}>
      <header style={ringHeaderStyle}>
        <span style={ringNameStyle}>{props.label}</span>
        {props.isCustom && (
          <>
            <span style={hexStyle}>{props.color}</span>
            <input
              type="color"
              value={props.color}
              onChange={(e) => props.onColorChange(e.target.value)}
              style={colorSwatchStyle}
            />
          </>
        )}
        {!props.isCustom && (
          <span
            style={{
              ...colorSwatchStyle,
              background: props.color,
              cursor: 'default',
            }}
            aria-hidden
          />
        )}
      </header>
      <Slider
        label="Tamanho"
        min={0}
        max={1}
        step={0.01}
        value={props.weight}
        onChange={props.onWeightChange}
      />
      <Slider
        label="Fluidez"
        min={0}
        max={1}
        step={0.01}
        value={props.fluidez}
        onChange={props.onFluidezChange}
      />
    </section>
  );
}

function ColorRow(props: {
  label: string;
  color: string;
  onChange: (c: string) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <label style={{ ...labelStyle, marginBottom: 0, flex: 1 }}>{props.label}</label>
      <span style={hexStyle}>{props.color}</span>
      <input
        type="color"
        value={props.color}
        onChange={(e) => props.onChange(e.target.value)}
        style={colorSwatchStyle}
      />
    </div>
  );
}

function Slider(props: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <section style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <label style={{ ...labelStyle, marginBottom: 0, fontSize: 12, color: '#a8a8b0' }}>
          {props.label}
        </label>
        <span style={{ color: '#9ca3af', fontSize: 12 }}>{props.value}</span>
      </div>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
        style={{ width: '100%' }}
      />
    </section>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 6,
  color: '#e5e5e5',
  fontWeight: 500,
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: '6px 8px',
  background: '#1a1a1f',
  border: '1px solid #2a2a30',
  color: '#e5e5e5',
  borderRadius: 4,
  fontSize: 13,
};

const buttonStyle: React.CSSProperties = {
  padding: '10px 14px',
  background: '#2a2a30',
  color: '#e5e5e5',
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 500,
};

const ringBlockStyle: React.CSSProperties = {
  marginTop: 16,
  marginBottom: 4,
  padding: '12px 12px 4px',
  background: '#16161b',
  border: '1px solid #25252c',
  borderRadius: 6,
};

const ringHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginBottom: 10,
  paddingBottom: 8,
  borderBottom: '1px solid #25252c',
};

const ringNameStyle: React.CSSProperties = {
  flex: 1,
  color: '#e5e5e5',
  fontWeight: 600,
  fontSize: 14,
};

const hexStyle: React.CSSProperties = {
  color: '#9ca3af',
  fontFamily: 'monospace',
  fontSize: 11,
};

const colorSwatchStyle: React.CSSProperties = {
  width: 28,
  height: 22,
  border: '1px solid #2a2a30',
  background: 'transparent',
  cursor: 'pointer',
  padding: 0,
  borderRadius: 3,
};

function chipStyle(active: boolean): React.CSSProperties {
  return {
    padding: '6px 10px',
    background: active ? '#6b46c1' : '#1a1a1f',
    color: active ? '#fff' : '#9ca3af',
    border: '1px solid ' + (active ? '#6b46c1' : '#2a2a30'),
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 12,
  };
}
