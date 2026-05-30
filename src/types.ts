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

export type BlobHarmonics = {
  // Outline distortion: r(θ) = baseR * (1 + irregularity · Σ amps[k]·sin(K[k]·θ + phases[k]))
  // K[k] starts at 3 (k=2 is intentionally skipped — it produces ellipses,
  // not organic blots). Multiple high-frequency harmonics layered together
  // give the irregular "ink-blot" silhouette.
  amps: number[];   // each in [-1, 1]
  phases: number[]; // each in [0, 2π]
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
