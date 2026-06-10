import { useEffect, useState, type DragEvent } from 'react';
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
  paletteOverrides: Record<string, { colors: [string, string, string, string, string, string, string]; name?: string }>;
  deletedPresets: string[];
  edited: boolean;
  mode: RenderMode;
  blobCount: number;
  irregularity: number;
  warp: number;
  warpScale: number;
  blobSizeMin: number;
  blobSizeMax: number;
  blobSizeVar: number;
  assetBands: number;
  assetWarp: number;
  assetCore: number;
  assetPresence: number[];
  grain: number;
  seed: number;
  playing: boolean;
  speed: number;
  videoProgress: { done: number; total: number } | null;
  videoQuality: '1080' | '4k';
  onVideoQualityChange: (q: '1080' | '4k') => void;
  videoFps: 60 | 24 | 18 | 12;
  onVideoFpsChange: (f: 60 | 24 | 18 | 12) => void;
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
  // Reordena cores por inserção. `from`/`to` são índices em customColors
  // (0=Fundo, 1..5=º0…º4, 6=Borda) — a posição real do card arrastado.
  onReorderColors: (from: number, to: number) => void;
  deletedColors: number[]; // índices (1..5) dos anéis internos deletados
  onDeleteColor: (colorIdx: number) => void;
  onRestoreColor: () => void;
  onSavePalette: () => void;
  onRevertPalette: () => void;
  onDeletePalette: (id: string) => void;
  onDuplicatePalette: () => void;
  onRenamePalette: () => void;
  onModeChange: (m: RenderMode) => void;
  onBlobCountChange: (n: number) => void;
  onIrregularityChange: (i: number) => void;
  onWarpChange: (v: number) => void;
  onWarpScaleChange: (v: number) => void;
  onBlobSizeMinChange: (v: number) => void;
  onBlobSizeMaxChange: (v: number) => void;
  onBlobSizeVarChange: (v: number) => void;
  onAssetBandsChange: (v: number) => void;
  onAssetWarpChange: (v: number) => void;
  onAssetCoreChange: (v: number) => void;
  onAssetPresenceChange: (i: number, v: number) => void;
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

// O dock sempre mostra o RASCUNHO da paleta ativa (customColors = [Fundo, º0…º4,
// Borda]) — toda paleta é editável diretamente.
function ringColorsFor(customColors: string[]): { fundo: string; rings: string[] } {
  return { fundo: customColors[0], rings: customColors.slice(1) };
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
            <button
              className={props.mode === 'asset' ? 'on' : ''}
              onClick={() => props.onModeChange('asset')}
            >
              Asset
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

      {/* CAMPO / ASSET */}
      <section className="group">
        {props.mode === 'asset' ? (
          <div className="sec-head"><span className="idx">A3</span><span className="ttl">/ ASSET</span><span className="meta">SHAPE BUILDER</span></div>
        ) : (
          <div className="sec-head"><span className="idx">A3</span><span className="ttl">/ CAMPO</span><span className="meta">BLOB FIELD</span></div>
        )}
        <div className="group-body">
          {props.mode === 'asset' ? (
            <>
              <Param label="Bandas" min={6} max={60} step={1} value={props.assetBands} onChange={props.onAssetBandsChange} />
              <Param label="Tamanho do núcleo" min={1} max={20} step={0.5} value={props.assetCore} onChange={props.onAssetCoreChange} />
              <Param label="Distorção" min={0} max={1} step={0.01} value={props.assetWarp} onChange={props.onAssetWarpChange} />
              <button className="btn" style={{ margin: '6px 0 10px' }} onClick={props.onRandomize}>
                <span className="ic">↻</span> Randomize
              </button>
              <div className="subnote">PRESENÇA DAS CORES · CENTRO → BORDA</div>
              {['º0', 'º1', 'º2', 'º3', 'º4', 'Borda'].map((lbl, i) => {
                // Anéis internos (i 0..4 → customColors 1..5) deletados somem daqui.
                if (i <= 4 && props.deletedColors.includes(i + 1)) return null;
                return (
                  <Param
                    key={lbl}
                    label={lbl}
                    min={0}
                    max={3}
                    step={0.05}
                    value={props.assetPresence[i] ?? 1}
                    onChange={(v) => props.onAssetPresenceChange(i, v)}
                  />
                );
              })}
            </>
          ) : (
            <>
              <Param label="Nº de blobs" min={1} max={8} step={1} value={props.blobCount} onChange={props.onBlobCountChange} />
              <Param label="Tamanho mín" min={0.04} max={0.5} step={0.01} value={props.blobSizeMin} onChange={props.onBlobSizeMinChange} />
              <Param label="Tamanho máx" min={0.04} max={0.5} step={0.01} value={props.blobSizeMax} onChange={props.onBlobSizeMaxChange} />
              <Param label="Variação do tamanho" min={0} max={1} step={0.01} value={props.blobSizeVar} onChange={props.onBlobSizeVarChange} />
              <button className="btn" style={{ margin: '6px 0 10px' }} onClick={props.onRandomize}>
                <span className="ic">↻</span> Randomize
              </button>
              <Param label="Irregularidade" min={0} max={3} step={0.01} value={props.irregularity} onChange={props.onIrregularityChange} />
              <Param label="Warp" min={0} max={3} step={0.01} value={props.warp} onChange={props.onWarpChange} />
              <Param label="Tamanho do warp" min={0} max={1} step={0.01} value={props.warpScale} onChange={props.onWarpScaleChange} />
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
          <div className="field-row" style={{ marginBottom: 10 }}>
            <span className="lbl">FPS</span>
            <div className="seg" style={{ flex: 1 }}>
              {([60, 24, 18, 12] as const).map((f) => (
                <button
                  key={f}
                  className={props.videoFps === f ? 'on' : ''}
                  disabled={props.videoProgress !== null}
                  onClick={() => props.onVideoFpsChange(f)}
                >
                  {f}
                </button>
              ))}
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
  const isCustom = true; // toda paleta é editável diretamente (não há mais "Custom")
  const colors = ringColorsFor(props.customColors);

  // Cor do chip: reflete a edição ao vivo (se for a ativa e editada), senão o
  // override salvo, senão o gradiente padrão do preset/paleta.
  const chipBg = (id: string, fallback: Palette | SavedPalette): React.CSSProperties => {
    let cols: string[] | undefined;
    if (props.paletteId === id && props.edited) cols = props.customColors;
    else if (props.paletteOverrides[id]) cols = props.paletteOverrides[id].colors;
    if (cols) return { background: `linear-gradient(90deg, ${cols[1]}, ${cols[3]}, ${cols[5]})` };
    return 'colors' in fallback ? savedSwStyle(fallback) : swStyle(fallback);
  };

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

  // Anéis internos ativos (não deletados) + Borda sempre. Fundo é card à parte.
  const visibleRings = rings.filter((r) => !props.deletedColors.includes(r.colorIdx));
  const activeInnerCount = 5 - props.deletedColors.length; // º0…º4 não deletados
  const canDelete = activeInnerCount > 2;

  // Drag-and-drop p/ reordenar as cores. A chave é o índice em customColors
  // (0=Fundo, 1..5=º0…º4, 6=Borda) — robusto a anéis escondidos por deleção.
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  const dragProps = (idx: number) => ({
    draggable: true,
    onDragStart: (e: DragEvent) => {
      setDragIdx(idx);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(idx)); // Firefox exige payload
    },
    onDragEnd: () => {
      setDragIdx(null);
      setOverIdx(null);
    },
  });

  const dropProps = (idx: number) => ({
    onDragOver: (e: DragEvent) => {
      if (dragIdx === null) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (overIdx !== idx) setOverIdx(idx);
    },
    onDragLeave: () => setOverIdx((s) => (s === idx ? null : s)),
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      if (dragIdx !== null && dragIdx !== idx) props.onReorderColors(dragIdx, idx);
      setDragIdx(null);
      setOverIdx(null);
    },
  });

  const colCls = (idx: number) =>
    'ringcol' +
    (dragIdx === idx ? ' dragging' : '') +
    (overIdx === idx && dragIdx !== idx ? ' drop-over' : '');

  // Head do card: rótulo + (deletar, p/ internos) + swatch arrastável + console.
  const ringHead = (r: { id: string; color: string; colorIdx: number }) => (
    <>
      <div className="rc-head">
        <span className="rid">{r.id}</span>
        <div className="rc-head-r">
          {r.colorIdx >= 1 && r.colorIdx <= 5 && canDelete && (
            <button className="ring-del" title="Deletar esta cor" onClick={() => props.onDeleteColor(r.colorIdx)}>×</button>
          )}
          <ColorSwatch
            className="swc"
            isCustom={isCustom}
            color={r.color}
            onChange={(c) => props.onCustomColorChange(r.colorIdx, c)}
            {...dragProps(r.colorIdx)}
          />
        </div>
      </div>
      <HexRgbInput
        isCustom={isCustom}
        color={r.color}
        onChange={(c) => props.onCustomColorChange(r.colorIdx, c)}
      />
    </>
  );

  return (
    <section className="dock">
      {/* ANÉIS */}
      <div className="dock-sub dock-rings">
        <div className="dock-head">
          <span className="dh-ttl">Anéis</span>
          <span className="dh-meta">{`${activeInnerCount} + BORDA + FUNDO · COR / TAMANHO / FLUIDEZ`}</span>
          {props.deletedColors.length > 0 && (
            <button className="btn hd-btn" onClick={props.onRestoreColor} title="Restaura o último anel deletado">
              <span className="ic">＋</span> Anel
            </button>
          )}
        </div>
        <div className="dock-body">
          <div className="ringdock">
            {props.mode === 'heatmap'
              ? visibleRings.map((r) => (
                  <div className={colCls(r.colorIdx)} key={r.id} {...dropProps(r.colorIdx)}>
                    {ringHead(r)}
                    <div className="rc-body">
                      <MiniParam label="TAMANHO" unit="rel" value={r.weight} onChange={r.onWeight} />
                      <MiniParam label="FLUIDEZ" unit="v" value={r.fluidez} onChange={r.onFluidez} />
                    </div>
                  </div>
                ))
              : visibleRings.map((r) => (
                  <div className={colCls(r.colorIdx)} key={r.id} {...dropProps(r.colorIdx)}>
                    {ringHead(r)}
                    <div className="rc-body">
                      <div className="rc-na">— MESH MODE —</div>
                    </div>
                  </div>
                ))}

            {/* FUNDO card — color only (colorIdx 0) */}
            <div className={colCls(0)} {...dropProps(0)}>
              <div className="rc-head"><span className="rid">Fundo</span></div>
              <div className="rc-body">
                <div className="rc-na fundo">
                  <ColorSwatch
                    className="swc"
                    isCustom={isCustom}
                    color={colors.fundo}
                    onChange={(c) => props.onCustomColorChange(0, c)}
                    {...dragProps(0)}
                  />
                  <HexRgbInput
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
          <span className="dh-meta">{props.edited ? 'NÃO SALVO' : ''}</span>
          <span className="hd-actions">
            {props.edited && (
              <>
                <button className="btn hd-btn" onClick={props.onRevertPalette} title="Descartar edições (volta ao último salvo)">
                  <span className="ic">↩</span> Reverter
                </button>
                <button className="btn hd-btn" onClick={props.onSavePalette} title="Salvar as edições nesta paleta (permanente)">
                  <span className="ic">💾</span> Salvar
                </button>
              </>
            )}
            <button className="btn hd-btn hd-ic" onClick={props.onDuplicatePalette} title="Duplicar esta paleta">⧉</button>
            <button className="btn hd-btn hd-ic" onClick={props.onRenamePalette} title="Renomear esta paleta">✎</button>
            <button className="btn hd-btn hd-ic" onClick={() => props.onDeletePalette(props.paletteId)} title="Deletar esta paleta">🗑</button>
          </span>
        </div>
        <div className="dock-body">
          <div className="chips">
            {PALETTES.filter((p) => !props.deletedPresets.includes(p.id)).map((p: Palette) => {
              const active = props.paletteId === p.id;
              return (
                <button
                  key={p.id}
                  className={'chip' + (active ? ' on' : '')}
                  onClick={() => props.onPaletteChange(p.id)}
                >
                  <span className="sw" style={chipBg(p.id, p)} />
                  {props.paletteOverrides[p.id]?.name ?? p.name}
                </button>
              );
            })}
            {props.savedPalettes.map((sp) => {
              const active = props.paletteId === sp.id;
              return (
                <span key={sp.id} className={'chip saved' + (active ? ' on' : '')}>
                  <span className="sw" style={chipBg(sp.id, sp)} />
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
  draggable?: boolean;
  onDragStart?: (e: DragEvent) => void;
  onDragEnd?: (e: DragEvent) => void;
}) {
  const drag = {
    draggable: props.draggable,
    onDragStart: props.onDragStart,
    onDragEnd: props.onDragEnd,
  };
  const dragCls = props.draggable ? ' draggable' : '';
  if (props.isCustom) {
    return (
      <input
        type="color"
        className={props.className + ' swatch-input' + dragCls}
        value={props.color}
        title="Clique para a roda de cores · arraste para reordenar"
        onChange={(e) => props.onChange(e.target.value)}
        {...drag}
      />
    );
  }
  return (
    <span
      className={props.className + ' static' + dragCls}
      style={{ background: props.color }}
      title="Arraste para reordenar"
      {...drag}
    />
  );
}

// Aceita HEX (#ff2ead, ff2ead, #f2a) ou RGB (rgb(255,46,173), 255,46,173,
// 255 46 173) e devolve sempre #rrggbb minúsculo; null se inválido.
function parseColorInput(raw: string): string | null {
  const s = raw.trim().toLowerCase();
  let m = s.match(/^#?([0-9a-f]{6})$/);
  if (m) return '#' + m[1];
  m = s.match(/^#?([0-9a-f]{3})$/);
  if (m) {
    const h = m[1];
    return '#' + h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  m = s.match(/^(?:rgb\s*\(\s*)?(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*\)?$/);
  if (m) {
    const r = +m[1], g = +m[2], b = +m[3];
    if (r <= 255 && g <= 255 && b <= 255) {
      const hx = (n: number) => n.toString(16).padStart(2, '0');
      return '#' + hx(r) + hx(g) + hx(b);
    }
  }
  return null;
}

// Console de texto por cor: digita HEX ou RGB direto. Edição só em modo Custom;
// fora dele mostra o valor atual (somente leitura), espelhando o swatch estático.
function HexRgbInput(props: { isCustom: boolean; color: string; onChange: (c: string) => void }) {
  const [text, setText] = useState(props.color);
  // Re-sincroniza quando a cor muda por fora (roda de cores, misturar, troca de paleta).
  useEffect(() => setText(props.color), [props.color]);

  if (!props.isCustom) {
    return (
      <div className="cc-row">
        <span className="cc-static">{parseColorInput(props.color) ?? props.color}</span>
      </div>
    );
  }

  const commit = () => {
    const parsed = parseColorInput(text);
    if (parsed) {
      props.onChange(parsed);
      setText(parsed);
    } else {
      setText(props.color); // inválido → reverte
    }
  };

  return (
    <div className="cc-row">
      <input
        type="text"
        className="cc-text"
        value={text}
        spellCheck={false}
        autoComplete="off"
        title="Digite HEX (#ff2ead) ou RGB (255,46,173)"
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
      />
    </div>
  );
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
