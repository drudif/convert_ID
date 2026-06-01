export type GradientStop = {
  offset: number;   // 0–1
  color: string;    // hex
  alpha: number;    // 0–1
};

export type BlobStops = {
  stops: GradientStop[];
};

export type Palette = {
  id: string;
  name: string;
  background: string;          // hex
  blobVariants: BlobStops[];   // 1 or more
  variantWeights?: number[];   // optional; parallel to blobVariants; uniform if omitted
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

export type RenderParams = {
  width: number;
  height: number;
  palette: Palette;
  composition: Composition;
  grain: number;        // 0–1
  blur: number;         // "1080p-equivalent" px; scaled at render time
  irregularity: number; // 0–1; amplitude of the per-blob outline distortion
  fluidez: number;      // 0–1; lowers the metaball threshold (wider silhouette)
  centroWeight: number; // 0–1; share of the LUT used by Centro→Anel 1
  anel1Weight: number;  // 0–1; share used by Anel 1→Anel 2
  anel2Weight: number;  // 0–1; share used by Anel 2→Borda; sum is clamped to 1
};
