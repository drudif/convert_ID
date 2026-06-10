export type GradientStop = {
  offset: number;   // 0–1
  color: string;    // hex
  alpha: number;    // 0–1
};

export type BlobStops = {
  stops: GradientStop[];
};

// Parâmetros de FORMA que um Estilo guarda além das cores: tamanho e difusão
// (ex-fluidez) dos 6 anéis (º0…º4, Borda), tamanho mín/máx dos blobs e os
// controles de deformação. Ordem dos arrays: [º0, º1, º2, º3, º4, Borda].
export type StyleParams = {
  ringWeights: [number, number, number, number, number, number];
  ringFluidez: [number, number, number, number, number, number];
  blobCount: number;
  blobSizeMin: number;
  blobSizeMax: number;
  blobSizeVar: number;
  warp: number;
  irregularity: number;
  warpScale: number;
};

export type Palette = {
  id: string;
  name: string;
  background: string;          // hex
  blobVariants: BlobStops[];   // 1 or more
  variantWeights?: number[];   // optional; parallel to blobVariants; uniform if omitted
  // Estilo: parâmetros de forma padrão deste preset (só os presets que definem;
  // os demais usam os defaults globais). Ignorados pelo renderer.
  style?: StyleParams;
  deletedColors?: number[];    // anéis internos colapsados por padrão neste estilo
};

export type BlobMini = {
  ox: number; // offset x in [-1, 1]; renderer scales by baseR · spread · irregularity
  oy: number;
};

export type BlobHarmonics = {
  // N identical "mini" field sources per blob. At irregularity=0 they all
  // stack at the blob centre and produce a field equivalent to a single
  // radius-R primary; as irregularity grows they spread within a tight
  // cloud, giving an asymmetric silhouette. Crucially they have IDENTICAL
  // radii (no dominant primary), so the heat map sees one unified peak at
  // the cluster's centroid instead of N distinct peaks.
  minis: BlobMini[];
};

export type CompositionBlob = {
  x: number;             // 0–1 normalized to width
  y: number;             // 0–1 normalized to height
  radius: number;        // 0–1 normalized to min(width, height); range [0.2, 0.5]
  variantIdx: number;    // index into palette.blobVariants
  harmonics: BlobHarmonics;
};

export type Composition = {
  seed: number;
  blobs: CompositionBlob[];
};

export type RenderMode = 'heatmap' | 'mesh' | 'asset';
export type MeshColorMode = 'solid' | 'palette';

export type RenderParams = {
  width: number;
  height: number;
  palette: Palette;
  composition: Composition;
  mode: RenderMode;       // 'heatmap' = filled blobs; 'mesh' = topographic contours
  grain: number;          // 0–1
  irregularity: number;   // mini-cluster spread amplitude (particle separation)
  warp: number;           // domain-warp amplitude (smooth silhouette deformation)
  warpScale: number;      // 0–1; size/length of the warp deformations
  // Animation. `time` advances while playing (seconds); the amounts below are
  // static. morphAmp drives the organic shape morph (both modes); meshFlow
  // scrolls the contour levels (mesh only). 0 = no motion.
  time: number;
  morphAmp: number;       // 0–1; shape-morph amplitude
  meshFlow: number;       // 0–1; contour flow speed (mesh)
  meshFlowDir: 1 | -1;    // +1 = inward (toward core), -1 = outward
  // Heatmap-only liquid flow. When drift > 0 the static composition is replaced
  // by a continuous, NON-LOOPING stream of blobs that drift across the whole
  // frame and exit, endlessly replaced by new ones entering. drift = 0 keeps
  // the designed static composition.
  drift: number;          // 0–1; current speed (0 = static composition)
  flowDensity: number;    // approx. number of blobs populating the frame
  flowSize: number;       // 0–1; flowing blob radius (fraction of min side)
  // In-place "surgimento": transient blobs that fade in/out at random spots,
  // layered on top of the base/flow. spawnRate = 0 = off.
  spawnRate: number;      // average new blobs per second
  spawnLife: number;      // seconds each surge lives (fade in → out)
  spawnSize: number;      // 0–1; surge blob radius (fraction of min side)
  spawnSizeVar: number;   // 0–1; how much the surge sizes vary randomly
  // Mesh (contour) mode only — ignored in heatmap mode.
  meshLevels: number;     // number of contour lines (line density)
  meshLineWidth: number;  // stroke width in px
  meshRelief: number;     // 0–1+; extends concentric contour lines outward
  meshLineColor: string;  // hex; contour line colour (solid mode)
  meshColorMode: MeshColorMode; // 'solid' = single ink; 'palette' = follow heatmap palette
  // Six nested rings (º0 innermost → Borda outermost = silhouette edge).
  // Each ring has a SIZE (spatial extent) and a FLUIDEZ (boundary blur).
  // Nesting is enforced at render time: each inner ring is clamped to the
  // size of the next outer one. º0 sits on top of every other ring.
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
  // Anéis internos deletados (índices em customColors: 1=º0 … 5=º4). A presença
  // desses anéis é forçada a 0 no heatmap, então o vizinho externo preenche o
  // espaço sem deixar franja. Borda(6)/Fundo(0) nunca entram aqui.
  deletedRings: number[];
  // ASSET mode — toolset próprio (só herda a paleta). Ordem das cores: centro =
  // º0 → borda externa. assetPresence (6, centro→borda) = quanto cada cor ocupa
  // no raio. assetBands = nº de bandas concêntricas. assetWarp = distorção.
  assetBands: number;
  assetWarp: number;
  assetCore: number; // tamanho da banda pura central (multiplicador vs banda normal)
  assetPresence: number[];
};
