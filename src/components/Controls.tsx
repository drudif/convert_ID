import type { MeshColorMode, Palette, RenderMode } from '../types';
import { PALETTES } from '../data/palettes';
import type { SavedPalette } from '../data/savedPalettes';

type Orientation = 'horizontal' | 'quadrado' | 'vertical';
type Quality = '1080' | '4k';

// Final pixel dimensions per (quality, orientation). Horizontal/vertical are
// exact 16:9 at each tier; square uses the tier's standard (short) side.
const FORMAT_DIMS: Record<Quality, Record<Orientation, [number, number]>> = {
  '1080': { horizontal: [1920, 1080], quadrado: [1080, 1080], vertical: [1080, 1920] },
  '4k':   { horizontal: [3840, 2160], quadrado: [2160, 2160], vertical: [2160, 3840] },
};

const ORIENTATIONS: Array<{ id: Orientation; label: string }> = [
  { id: 'horizontal', label: 'Horizontal' },
  { id: 'quadrado', label: 'Quadrado' },
  { id: 'vertical', label: 'Vertical' },
];

function orientationOf(w: number, h: number): Orientation {
  if (w > h) return 'horizontal';
  if (w < h) return 'vertical';
  return 'quadrado';
}

function qualityOf(w: number, h: number): Quality {
  return Math.max(w, h) >= 3000 ? '4k' : '1080';
}

export type ControlsProps = {
  width: number;
  height: number;
  paletteId: string;
  customColors: [string, string, string, string, string, string, string];
  savedPalettes: SavedPalette[];
  mode: RenderMode;
  blobCount: number;
  irregularity: number;
  grain: number;
  seed: number;
  playing: boolean;
  speed: number;
  videoProgress: { done: number; total: number } | null;
  videoQuality: '1080' | '4k';
  onVideoQualityChange: (q: '1080' | '4k') => void;
  onExportVideo: () => void;
  onExportPreview: () => void;
  onCancelExport: () => void;
  morphAmp: number;
  meshFlow: number;
  meshFlowDir: 1 | -1;
  drift: number;
  flowDensity: number;
  flowSize: number;
  spawnRate: number;
  spawnLife: number;
  spawnSize: number;
  spawnSizeVar: number;
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
  onModeChange: (m: RenderMode) => void;
  onBlobCountChange: (n: number) => void;
  onIrregularityChange: (i: number) => void;
  onGrainChange: (g: number) => void;
  onPlayingChange: (p: boolean) => void;
  onSpeedChange: (s: number) => void;
  onMorphAmpChange: (m: number) => void;
  onMeshFlowChange: (f: number) => void;
  onMeshFlowDirChange: (d: 1 | -1) => void;
  onDriftChange: (d: number) => void;
  onFlowDensityChange: (n: number) => void;
  onFlowSizeChange: (s: number) => void;
  onSpawnRateChange: (r: number) => void;
  onSpawnLifeChange: (l: number) => void;
  onSpawnSizeChange: (s: number) => void;
  onSpawnSizeVarChange: (v: number) => void;
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

// ============================================================
// LEFT — IMAGEM panel
// ============================================================
export function ImagemPanel(props: ControlsProps) {
  const orientation = orientationOf(props.width, props.height);
  const quality = qualityOf(props.width, props.height);
  const applyFormat = (o: Orientation, q: Quality) => {
    const [w, h] = FORMAT_DIMS[q][o];
    props.onWidthChange(w);
    props.onHeightChange(h);
  };

  return (
    <aside className="controls">
      <div className="zone-head">
        <span className="zn">IMAGEM</span>
        <span className="zsub">DEFINE O STILL / PNG</span>
        <span className="zix">A</span>
      </div>

      {/* MODE */}
      <section className="group">
        <div className="sec-head"><span className="idx">A1</span><span className="ttl">/ MODO</span><span className="meta">RENDER PIPELINE</span></div>
        <div className="group-body">
          <div className="toggle">
            <button
              className={props.mode === 'heatmap' ? 'on' : ''}
              onClick={() => props.onModeChange('heatmap')}
            >
              Heat map
            </button>
            <button
              className={props.mode === 'mesh' ? 'on' : ''}
              onClick={() => props.onModeChange('mesh')}
            >
              Mesh
            </button>
          </div>
        </div>
      </section>

      {/* FORMAT */}
      <section className="group">
        <div className="sec-head"><span className="idx">A2</span><span className="ttl">/ FORMATO</span><span className="meta">OUTPUT GEOMETRY</span></div>
        <div className="group-body">
          <div className="field-row" style={{ marginBottom: 10 }}>
            <span className="lbl">ORIENTAÇÃO</span>
            <div className="seg" style={{ flex: 1 }}>
              {ORIENTATIONS.map((o) => (
                <button
                  key={o.id}
                  className={orientation === o.id ? 'on' : ''}
                  onClick={() => applyFormat(o.id, quality)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div className="field-row">
            <span className="lbl">QUALIDADE</span>
            <div className="seg" style={{ flex: 1 }}>
              <button className={quality === '1080' ? 'on' : ''} onClick={() => applyFormat(orientation, '1080')}>1080</button>
              <button className={quality === '4k' ? 'on' : ''} onClick={() => applyFormat(orientation, '4k')}>4K</button>
            </div>
          </div>
        </div>
      </section>

      {/* CAMPO */}
      <section className="group">
        <div className="sec-head"><span className="idx">A3</span><span className="ttl">/ CAMPO</span><span className="meta">BLOB FIELD</span></div>
        <div className="group-body">
          <Param label="Nº de blobs" min={1} max={8} step={1} value={props.blobCount} onChange={props.onBlobCountChange} />
          <button className="btn" style={{ margin: '6px 0 10px' }} onClick={props.onRandomize}>
            <span className="ic">↻</span> Randomize
          </button>
          <Param label="Irregularidade" min={0} max={1} step={0.01} value={props.irregularity} onChange={props.onIrregularityChange} />
          <Param label="Grão" min={0} max={1} step={0.01} value={props.grain} onChange={props.onGrainChange} />

          {props.mode === 'mesh' && (
            <>
              <Param label="Densidade de linhas" min={4} max={80} step={1} value={props.meshLevels} onChange={props.onMeshLevelsChange} />
              <Param label="Espessura" min={0.4} max={3} step={0.1} value={props.meshLineWidth} onChange={props.onMeshLineWidthChange} />
              <Param label="Relevo extra" min={0} max={1.5} step={0.01} value={props.meshRelief} onChange={props.onMeshReliefChange} />
              <div className="subnote">COR DA LINHA</div>
              <div className="seg" style={{ marginBottom: 10 }}>
                <button className={props.meshColorMode === 'solid' ? 'on' : ''} onClick={() => props.onMeshColorModeChange('solid')}>Sólida</button>
                <button className={props.meshColorMode === 'palette' ? 'on' : ''} onClick={() => props.onMeshColorModeChange('palette')}>Seguir paleta</button>
              </div>
              {props.meshColorMode === 'solid' && (
                <ColorRow label="Cor" color={props.meshLineColor} onChange={props.onMeshLineColorChange} />
              )}
            </>
          )}

          <button className="btn cta-img" style={{ marginTop: 14 }} onClick={props.onDownload}>
            <span className="ic">⬇</span> Baixar PNG
          </button>
        </div>
      </section>
    </aside>
  );
}

// ============================================================
// RIGHT — VÍDEO / ANIMAÇÃO panel
// ============================================================
export function VideoPanel(props: ControlsProps) {
  // Animation controls stay editable even when paused, so you can dial in the
  // animation/export at any time. (Pausing still shows the still PNG.)
  const disabled = false;
  return (
    <aside className="video-panel">
      <div className="zone-head video">
        <span className="zn">VÍDEO / ANIMAÇÃO</span>
        <span className="zsub">O MOVIMENTO + MP4</span>
        <span className="zix">B</span>
      </div>

      <section className="group">
        <div className="sec-head"><span className="idx">B1</span><span className="ttl">/ MOVIMENTO</span><span className="meta">LIQUID FLOW</span></div>
        <div className="group-body">
          <div className="transport" style={{ marginBottom: 12 }}>
            <button
              className={props.playing ? 'play' : ''}
              onClick={() => props.onPlayingChange(true)}
            >
              <span className="ic">▶</span> PLAY
            </button>
            <button
              className={!props.playing ? 'play' : ''}
              onClick={() => props.onPlayingChange(false)}
            >
              <span className="ic">❚❚</span> PAUSE
            </button>
          </div>

          <Param label="Velocidade" min={0.1} max={3} step={0.1} value={props.speed} onChange={props.onSpeedChange} disabled={disabled} unit="×" />
          <Param label="Morph (forma)" min={0} max={1} step={0.01} value={props.morphAmp} onChange={props.onMorphAmpChange} disabled={disabled} />

          {props.mode === 'heatmap' && (
            <>
              <Param label="Correnteza (fluxo líquido)" min={0} max={1} step={0.01} value={props.drift} onChange={props.onDriftChange} disabled={disabled} />
              {props.drift > 0 && (
                <>
                  <Param label="Densidade do fluxo" min={1} max={20} step={1} value={props.flowDensity} onChange={props.onFlowDensityChange} disabled={disabled} />
                  <Param label="Tamanho no fluxo" min={0.04} max={0.5} step={0.01} value={props.flowSize} onChange={props.onFlowSizeChange} disabled={disabled} />
                </>
              )}
              <Param label="Surgimento (taxa)" min={0} max={3} step={0.05} value={props.spawnRate} onChange={props.onSpawnRateChange} disabled={disabled} unit="/s" />
              {props.spawnRate > 0 && (
                <>
                  <Param label="Duração do surgimento" min={0.5} max={12} step={0.5} value={props.spawnLife} onChange={props.onSpawnLifeChange} disabled={disabled} unit="s" />
                  <Param label="Tamanho dos novos" min={0.04} max={0.5} step={0.01} value={props.spawnSize} onChange={props.onSpawnSizeChange} disabled={disabled} />
                  <Param label="Variação do tamanho" min={0} max={1} step={0.01} value={props.spawnSizeVar} onChange={props.onSpawnSizeVarChange} disabled={disabled} />
                </>
              )}
            </>
          )}

          {props.mode === 'mesh' && (
            <>
              <div className="subnote">MESH ONLY — CONTORNOS</div>
              <Param label="Fluxo de contornos" min={0} max={1} step={0.01} value={props.meshFlow} onChange={props.onMeshFlowChange} disabled={disabled} />
              <div className={'seg' + (disabled ? ' disabled' : '')} style={{ marginTop: 10 }}>
                <button
                  className={props.meshFlowDir === -1 ? 'on' : ''}
                  disabled={disabled}
                  onClick={() => props.onMeshFlowDirChange(-1)}
                >
                  Pra fora ↗
                </button>
                <button
                  className={props.meshFlowDir === 1 ? 'on' : ''}
                  disabled={disabled}
                  onClick={() => props.onMeshFlowDirChange(1)}
                >
                  Pra dentro ↙
                </button>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="group">
        <div className="sec-head"><span className="idx">B2</span><span className="ttl">/ EXPORTAR</span><span className="meta">MOVIE OUT</span></div>
        <div className="group-body">
          <div className="field-row" style={{ marginBottom: 10 }}>
            <span className="lbl">RESOLUÇÃO</span>
            <div className="seg" style={{ flex: 1 }}>
              <button
                className={props.videoQuality === '1080' ? 'on' : ''}
                disabled={props.videoProgress !== null}
                onClick={() => props.onVideoQualityChange('1080')}
              >
                1080
              </button>
              <button
                className={props.videoQuality === '4k' ? 'on' : ''}
                disabled={props.videoProgress !== null}
                onClick={() => props.onVideoQualityChange('4k')}
              >
                4K
              </button>
            </div>
          </div>
          {props.videoProgress !== null ? (
            <div className="btn-grid c2">
              <button className="btn exporting" disabled>
                <span
                  className="bar"
                  style={{ width: `${Math.round((props.videoProgress.done / props.videoProgress.total) * 100)}%` }}
                />
                <span className="txt">
                  {`${Math.round((props.videoProgress.done / props.videoProgress.total) * 100)}%`}
                </span>
              </button>
              <button className="btn ghost cancel" onClick={props.onCancelExport}>
                <span className="ic">✕</span> Cancelar
              </button>
            </div>
          ) : (
            <div className="btn-grid c2">
              <button className="btn ghost" onClick={props.onExportPreview}>
                <span className="ic">👁</span> Preview 480p
              </button>
              <button className="btn cta" onClick={props.onExportVideo}>
                <span className="ic">🎬</span> Exportar MP4 {props.videoQuality === '4k' ? '4K' : '1080'}
              </button>
            </div>
          )}
        </div>
      </section>
    </aside>
  );
}

// ============================================================
// BOTTOM — RINGS + PALETTE dock
// ============================================================
export function ColorRingsDock(props: ControlsProps) {
  const isCustom = props.paletteId === 'custom';
  const colors = ringColorsFor(props.paletteId, props.customColors, props.savedPalettes);

  const rings: Array<{
    id: string;
    color: string;
    colorIdx: number;
    weight: number;
    fluidez: number;
    onWeight: (w: number) => void;
    onFluidez: (f: number) => void;
  }> = [
    { id: 'º0', color: colors.rings[0], colorIdx: 1, weight: props.ring0Weight, fluidez: props.ring0Fluidez, onWeight: props.onRing0WeightChange, onFluidez: props.onRing0FluidezChange },
    { id: 'º1', color: colors.rings[1], colorIdx: 2, weight: props.ring1Weight, fluidez: props.ring1Fluidez, onWeight: props.onRing1WeightChange, onFluidez: props.onRing1FluidezChange },
    { id: 'º2', color: colors.rings[2], colorIdx: 3, weight: props.ring2Weight, fluidez: props.ring2Fluidez, onWeight: props.onRing2WeightChange, onFluidez: props.onRing2FluidezChange },
    { id: 'º3', color: colors.rings[3], colorIdx: 4, weight: props.ring3Weight, fluidez: props.ring3Fluidez, onWeight: props.onRing3WeightChange, onFluidez: props.onRing3FluidezChange },
    { id: 'º4', color: colors.rings[4], colorIdx: 5, weight: props.ring4Weight, fluidez: props.ring4Fluidez, onWeight: props.onRing4WeightChange, onFluidez: props.onRing4FluidezChange },
    { id: 'Borda', color: colors.rings[5], colorIdx: 6, weight: props.bordaWeight, fluidez: props.bordaFluidez, onWeight: props.onBordaWeightChange, onFluidez: props.onBordaFluidezChange },
  ];

  const savedCount = props.savedPalettes.length;

  return (
    <section className="dock">
      {/* ANÉIS */}
      <div className="dock-sub dock-rings">
        <div className="dock-head">
          <span className="dh-ttl">Anéis</span>
          <span className="dh-meta">6 LAYERS + FUNDO · COR / TAMANHO / FLUIDEZ</span>
        </div>
        <div className="dock-body">
          <div className="ringdock">
            {props.mode === 'heatmap' ? (
              rings.map((r) => (
                <div className="ringcol" key={r.id}>
                  <div className="rc-head">
                    <span className="rid">{r.id}</span>
                    <ColorSwatch
                      className="swc"
                      isCustom={isCustom}
                      color={r.color}
                      onChange={(c) => props.onCustomColorChange(r.colorIdx, c)}
                    />
                  </div>
                  <div className="rc-body">
                    <MiniParam label="TAMANHO" unit="rel" value={r.weight} onChange={r.onWeight} />
                    <MiniParam label="FLUIDEZ" unit="v" value={r.fluidez} onChange={r.onFluidez} />
                  </div>
                </div>
              ))
            ) : (
              rings.map((r) => (
                <div className="ringcol" key={r.id}>
                  <div className="rc-head">
                    <span className="rid">{r.id}</span>
                    <ColorSwatch
                      className="swc"
                      isCustom={isCustom}
                      color={r.color}
                      onChange={(c) => props.onCustomColorChange(r.colorIdx, c)}
                    />
                  </div>
                  <div className="rc-body">
                    <div className="rc-na">— MESH MODE —</div>
                  </div>
                </div>
              ))
            )}

            {/* FUNDO card — color only */}
            <div className="ringcol">
              <div className="rc-head"><span className="rid">Fundo</span></div>
              <div className="rc-body">
                <div className="rc-na fundo">
                  <ColorSwatch
                    className="swc"
                    isCustom={isCustom}
                    color={colors.fundo}
                    onChange={(c) => props.onCustomColorChange(0, c)}
                  />
                  <span>SEM TAM/FLU</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rule" />

      {/* PALETA / CORES */}
      <div className="dock-sub dock-pal">
        <div className="dock-head">
          <span className="dh-ttl">Paleta / Cores</span>
          <span className="dh-meta">{`${PALETTES.length} PRESETS · CUSTOM · ${savedCount} SAVED`}</span>
          {isCustom && (
            <button className="btn hd-btn" onClick={props.onSavePalette}>
              <span className="ic">💾</span> Salvar paleta
            </button>
          )}
        </div>
        <div className="dock-body">
          <div className="chips">
            {PALETTES.map((p: Palette) => (
              <button
                key={p.id}
                className={'chip' + (props.paletteId === p.id ? ' on' : '')}
                onClick={() => props.onPaletteChange(p.id)}
              >
                <span className="sw" style={swStyle(p)} />
                {p.name}
              </button>
            ))}
            <button
              key="custom"
              className={'chip custom' + (isCustom ? ' on' : '')}
              onClick={() => props.onPaletteChange('custom')}
            >
              <span className="sw" style={{ background: 'repeating-linear-gradient(45deg,#9F75FF 0 4px,#161618 4px 8px)' }} />
              Custom
            </button>
            {props.savedPalettes.map((sp) => {
              const active = props.paletteId === sp.id;
              return (
                <span key={sp.id} className={'chip saved' + (active ? ' on' : '')}>
                  <span className="sw" style={savedSwStyle(sp)} />
                  <button className="chip-name" onClick={() => props.onPaletteChange(sp.id)}>{sp.name}</button>
                  <button className="del" title="Apagar paleta" onClick={() => props.onDeletePalette(sp.id)}>×</button>
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function swStyle(p: Palette): React.CSSProperties {
  const stops = p.blobVariants[0].stops;
  const a = stops[0]?.color ?? p.background;
  const b = stops[2]?.color ?? a;
  const c = stops[4]?.color ?? b;
  return { background: `linear-gradient(90deg, ${a}, ${b}, ${c})` };
}

function savedSwStyle(sp: SavedPalette): React.CSSProperties {
  const [, a, , c, , e] = sp.colors;
  return { background: `linear-gradient(90deg, ${a}, ${c}, ${e})` };
}

function ColorSwatch(props: {
  className: string;
  isCustom: boolean;
  color: string;
  onChange: (c: string) => void;
}) {
  if (props.isCustom) {
    return (
      <input
        type="color"
        className={props.className + ' swatch-input'}
        value={props.color}
        onChange={(e) => props.onChange(e.target.value)}
      />
    );
  }
  return <span className={props.className + ' static'} style={{ background: props.color }} aria-hidden />;
}

function ColorRow(props: { label: string; color: string; onChange: (c: string) => void }) {
  return (
    <div className="field-row" style={{ marginTop: 4 }}>
      <span className="lbl">{props.label}</span>
      <span className="hex" style={{ flex: 1 }}>{props.color}</span>
      <input
        type="color"
        className="swatch-input"
        value={props.color}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </div>
  );
}

function Param(props: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
  unit?: string;
}) {
  return (
    <div className={'param' + (props.disabled ? ' disabled' : '')}>
      <span className="name">{props.label}</span>
      <span className="read">
        {props.value}
        {props.unit ? <span className="unit">{props.unit}</span> : null}
      </span>
      <input
        type="range"
        className="slider-input"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        disabled={props.disabled}
        onChange={(e) => props.onChange(Number(e.target.value))}
      />
    </div>
  );
}

function MiniParam(props: {
  label: string;
  unit: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="rc-param">
      <div className="lab">
        <span>{props.label}</span>
        <b>{props.value.toFixed(2)}<span className="unit">{props.unit}</span></b>
      </div>
      <input
        type="range"
        className="mini-input"
        min={0}
        max={1}
        step={0.01}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
      />
    </div>
  );
}
