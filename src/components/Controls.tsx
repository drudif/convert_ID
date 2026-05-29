import type { Palette } from '../types';
import { PALETTES } from '../data/palettes';

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
  customColors: [string, string, string, string, string];
  blobCount: number;
  irregularity: number;
  grain: number;
  blur: number;
  hardness: number;
  onWidthChange: (w: number) => void;
  onHeightChange: (h: number) => void;
  onPaletteChange: (id: string) => void;
  onCustomColorChange: (idx: number, color: string) => void;
  onBlobCountChange: (n: number) => void;
  onIrregularityChange: (i: number) => void;
  onGrainChange: (g: number) => void;
  onBlurChange: (b: number) => void;
  onHardnessChange: (h: number) => void;
  onRandomize: () => void;
  onDownload: () => void;
};

const CUSTOM_SLOT_LABELS = ['Fundo', 'Centro', 'Anel 1', 'Anel 2', 'Borda'];

function clampDim(n: number): number {
  if (!Number.isFinite(n) || n < 1) return 1;
  if (n > MAX_DIM) return MAX_DIM;
  return Math.round(n);
}

export function Controls(props: Props) {
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
      <h1 style={{ fontSize: 18, margin: '0 0 20px' }}>Auragen</h1>

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
        </div>
        {props.paletteId === 'custom' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            {CUSTOM_SLOT_LABELS.map((label, idx) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ ...labelStyle, marginBottom: 0, flex: 1 }}>{label}</label>
                <span style={{ color: '#9ca3af', fontFamily: 'monospace', fontSize: 11 }}>
                  {props.customColors[idx]}
                </span>
                <input
                  type="color"
                  value={props.customColors[idx]}
                  onChange={(e) => props.onCustomColorChange(idx, e.target.value)}
                  style={{
                    width: 36,
                    height: 24,
                    border: '1px solid #2a2a30',
                    background: 'transparent',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                />
              </div>
            ))}
          </div>
        )}
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
      <Slider
        label="Blur"
        min={0}
        max={300}
        step={1}
        value={props.blur}
        onChange={props.onBlurChange}
      />
      <Slider
        label="Dureza"
        min={0}
        max={1}
        step={0.01}
        value={props.hardness}
        onChange={props.onHardnessChange}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 20 }}>
        <button onClick={props.onRandomize} style={buttonStyle}>↻ Randomize</button>
        <button onClick={props.onDownload} style={{ ...buttonStyle, background: '#6b46c1' }}>
          ⬇ Baixar PNG
        </button>
      </div>
    </aside>
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
    <section style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <label style={labelStyle}>{props.label}</label>
        <span style={{ color: '#9ca3af' }}>{props.value}</span>
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
