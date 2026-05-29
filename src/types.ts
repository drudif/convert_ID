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

export type CompositionBlob = {
  x: number;          // 0–1 normalized to width
  y: number;          // 0–1 normalized to height
  radius: number;     // 0–1 normalized to min(width, height); range [0.2, 0.5]
  variantIdx: number; // index into palette.blobVariants
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
  hardness: number;     // 0–1; compresses gradient stops toward center
  irregularity: number; // 0–1; cluster jitter on each blob
  fluidez: number;      // 0–1; CSS contrast amount for metaball fusion
};
