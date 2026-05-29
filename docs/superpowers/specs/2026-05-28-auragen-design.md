# Auragen — Design Spec (v1)

**Status:** approved design, ready for implementation plan
**Date:** 2026-05-28
**Owner:** Fernando

## 1. Purpose

Auragen is a browser-based tool that generates abstract "aura gradient" images programmatically (not via generative AI). The user picks a palette, hits randomize, tweaks a few sliders, and downloads a high-resolution PNG.

Target use cases:
- Backgrounds and hero sections for websites
- General visual experimentation / personal use

The aesthetic for v1 is locked to the reference family the user provided: dark backgrounds + warm radial-gradient blobs + heavy film-grain overlay + strong blur. A later v2 will open up full flexibility (any colors, manual blob placement, better grain).

## 2. Scope

### In scope (v1)

- Single-page web app, fully client-side
- 3 curated palettes
- Number-of-blobs slider (1–8)
- Grain intensity slider (0–1)
- Blur intensity slider (0–300, scales with resolution)
- Resolution: free W/H input + 4 quick presets (1080p, 4K, Square 4096, Vertical 9:16), capped at 3840 per dimension
- "Randomize" button (re-seeds composition)
- "Download PNG" button (renders at full resolution and triggers download)
- Live preview, debounced

### Out of scope (v1, deferred to v2+)

- Manual blob positioning (drag/click on canvas)
- User-defined palettes / arbitrary color picking per blob
- Advanced grain (color noise, multi-frequency, 1/f spectrum, real scanned-film tiles)
- WebGL renderer (better fidelity for metaball-style merging in reference #3)
- Persistence (saving compositions, history, favorites)
- Backend, auth, deployment infrastructure

## 3. Architecture

100% client-side. Stack: **Vite + React + TypeScript**.

The architectural rule that matters: **the renderer is decoupled from the UI.** UI reads/writes a `RenderParams` object and calls a pure `render(canvas, params)` function. This guarantees the v2 swap to WebGL touches only the renderer module, not the UI.

### File structure

```
src/
├── App.tsx                  # root layout
├── main.tsx
├── types.ts                 # RenderParams, Composition, Palette
├── components/
│   ├── Controls.tsx         # left sidebar controls
│   └── Preview.tsx          # canvas preview
├── renderer/
│   ├── composition.ts       # seed → blob positions/sizes
│   ├── render.ts            # composition + params → canvas
│   ├── grain.ts             # noise tile generator + compositor
│   └── export.ts            # high-res render + PNG download
├── data/
│   └── palettes.ts          # preset palettes
└── lib/
    └── prng.ts              # mulberry32 seeded PRNG
```

Each module in `renderer/` is a pure function (input → output), testable in isolation, no React dependency.

## 4. UI / Layout

Two-panel layout. Fixed ~320px sidebar on the left holds all controls. Remaining area shows the canvas preview, centered, scaled to fit while preserving aspect ratio. App background is dark (so it doesn't compete with the generated image).

```
┌────────────────┬────────────────────────────────┐
│ CONTROLES      │                                │
│                │                                │
│ Resolução      │                                │
│ [1920] x [1080]│                                │
│ ⌐ 1080p ¬      │                                │
│ ⌐ 4K ¬         │        ┌──────────────┐        │
│ ⌐ Quadrado ¬   │        │              │        │
│ ⌐ Vertical ¬   │        │   PREVIEW    │        │
│                │        │              │        │
│ Paleta         │        └──────────────┘        │
│ ⌐ Nightfall ¬  │                                │
│ ⌐ Eclipse ¬    │                                │
│ ⌐ Aurora ¬     │                                │
│                │                                │
│ Nº de blobs    │                                │
│ ──○──────  3   │                                │
│                │                                │
│ Grão           │                                │
│ ──────○──  0.6 │                                │
│                │                                │
│ Blur           │                                │
│ ─────○───  120 │                                │
│                │                                │
│ [↻ Randomize]  │                                │
│ [⬇ Baixar PNG] │                                │
└────────────────┴────────────────────────────────┘
```

### Controls

| Control       | Type            | Range / values                              | Notes                                                       |
|---------------|-----------------|----------------------------------------------|-------------------------------------------------------------|
| Width         | number input    | 1–3840                                       | Paired with Height                                          |
| Height        | number input    | 1–3840                                       | Paired with Width                                           |
| Presets       | chips (4)       | 1080p (1920×1080), 4K (3840×2160), Quadrado (4096×4096 — clamped to 3840), Vertical (2160×3840) | Sets W and H on click                                       |
| Palette       | chips (3)       | Nightfall, Eclipse, Aurora                   | Single-select                                               |
| Blob count    | slider          | 1–8 (integer)                                |                                                             |
| Grain         | slider          | 0–1                                          | Used as `globalAlpha` for grain overlay                     |
| Blur          | slider          | 0–300                                        | "1080p-equivalent" px; scaled to actual resolution at render |
| Randomize     | button          | —                                            | New seed → new composition                                  |
| Download PNG  | button          | —                                            | Renders at full target resolution and triggers download     |

**Quadrado preset note:** the table lists 4096 for clarity, but it must be clamped to 3840 to stay within the per-dimension cap. Final value: 3840 × 3840.

### Preview behavior

- Preview canvas renders at a scaled-down size (max ~800px on the longest side) so it stays responsive
- Re-renders on any parameter change, debounced ~50ms
- Maintains the aspect ratio of the chosen W × H
- Visually identical to the exported image (same `render()` function, just smaller)

### Initial state (first paint)

- Resolution: 1920 × 1080 (the 1080p preset)
- Palette: Nightfall
- Blob count: 3
- Grain: 0.6
- Blur: 120
- Seed: a fixed deterministic value (e.g. `1`) so the first render is reproducible across sessions

## 5. Renderer & Data Model

### Data model (`types.ts`)

```ts
type Palette = {
  id: string;
  name: string;
  background: string;          // hex
  blobVariants: BlobStops[];   // 1+ gradient variants per palette
  variantWeights?: number[];   // optional, parallel array; defaults to uniform
};

type BlobStops = {
  stops: Array<{ offset: number; color: string; alpha: number }>;
};

type Composition = {
  seed: number;
  blobs: Array<{
    x: number;          // 0–1 normalized
    y: number;          // 0–1 normalized
    radius: number;     // 0–1 normalized to min(width, height)
    variantIdx: number; // index into palette.blobVariants
  }>;
};

type RenderParams = {
  width: number;
  height: number;
  palette: Palette;
  composition: Composition;
  grain: number;   // 0–1
  blur: number;    // "1080p-equivalent" px; scaled at render time
};
```

### Composition generation (`renderer/composition.ts`)

Pure function:

```ts
generateComposition(seed: number, blobCount: number, palette: Palette): Composition
```

Uses `mulberry32(seed)` for all random draws (reproducible from seed). For each blob:
- `x, y` ∈ [0, 1], uniform random
- `radius` ∈ [0.2, 0.5] of `min(w, h)`, uniform random
- `variantIdx` chosen by weighted sample over `palette.blobVariants` (uniform if no weights provided)

No edge bias in v1 — placements are uniform. The user iterates with the Randomize button.

### Render pipeline (`renderer/render.ts`)

```ts
render(targetCanvas: HTMLCanvasElement, params: RenderParams): void
```

Steps:

1. **Background:** fill the target canvas with `palette.background`.
2. **Blob layer (offscreen):** create an offscreen canvas the same size as `targetCanvas`. Set `globalCompositeOperation = 'lighter'`. For each blob: `createRadialGradient(x*w, y*h, 0, x*w, y*h, r*min(w,h))`, add stops from the selected variant, `fillRect` covering the blob's bounding area.
3. **Blur composite:** on the target context, set `filter = 'blur(${blur * min(w,h)/1080}px)'`. Call `drawImage(offscreen, 0, 0)`. This blurs the entire composition once (not per blob).
4. **Grain overlay:** clear filter, set `globalCompositeOperation = 'overlay'`, `globalAlpha = grain`, then `drawImage` the cached noise tile tiled across the canvas.

Two decisions critical to fidelity:
- **`globalCompositeOperation = 'lighter'`** (additive blending) is what produces reference #3's hotspots — overlapping blobs sum their colors, brightening the overlap zone.
- **Blur applied once to the whole offscreen composition** (not per blob) — replicates the continuous-field look of the references.

### Grain (`renderer/grain.ts`)

- Pre-generate one 512×512 noise tile (random grayscale pixel values) once per session, cached in module scope.
- Compositor function `applyGrain(targetCanvas, intensity)` tiles the noise across the canvas with `globalCompositeOperation = 'overlay'` and `globalAlpha = intensity`.
- The same tile scales to any output size via tiling.

**Known limitation (v1):** this is the simplest possible grain — white noise, monochrome, single frequency, blended with overlay. Real film grain is colored, multi-frequency, and luminance-dependent. This is the v1 minimum; v2 must improve it.

### Export (`renderer/export.ts`)

- Create an offscreen canvas at the user's chosen W × H (no preview scaling).
- Call the same `render()` function.
- `canvas.toBlob('image/png')` → trigger download via a temporary `<a>` element with object URL.
- Filename: `auragen-{paletteId}-{seed}-{W}x{H}.png`.

### Preview vs export

The preview uses `render()` with reduced W × H (max ~800px on the long side). Export uses real W × H. Same function, same visual result — preview is just a smaller render.

### Resolution scaling

Two things scale with output dimensions:
- **Blur:** `actualBlurPx = blur * (min(w, h) / 1080)`. So a slider value of 120 looks the same at 1080p and 4K.
- **Blob radius:** stored as a fraction of `min(w, h)`, so the same composition scales naturally.

Grain does not scale — it tiles, so the noise grain is the same pixel-frequency at any resolution. (Intentional: this looks "right" for film grain. If v2 wants per-resolution grain frequency, that's a v2 problem.)

## 6. Palettes (`data/palettes.ts`)

Three presets, all inspired by the reference images.

### Nightfall — refs #1 and #2 (purple/pink/orange)

```
background: #1a0d3d
variant A (default):
  0%   #ff7a4d  alpha 1.0   (orange core)
  35%  #ec4899  alpha 0.9   (magenta mid)
  65%  #6b46c1  alpha 0.5   (purple outer)
  100% transparent
```

### Eclipse — warmer single-tone (close to ref #1)

```
background: #1f0a3d
variant A:
  0%   #ffa066  alpha 1.0
  40%  #ff4d6d  alpha 0.85
  100% transparent
```

### Aurora — ref #3 (orange blobs with cyan hotspots)

```
background: #2d0e6e
variant A (standard blob):
  0%   #ff8855  alpha 1.0
  50%  #d946ef  alpha 0.7
  100% transparent

variant B (hotspot blob):
  0%   #67e8f9  alpha 1.0   (cyan core)
  20%  #ff8855  alpha 0.9
  60%  #d946ef  alpha 0.5
  100% transparent

variantWeights: [0.7, 0.3]   // ~30% of blobs get the hotspot variant
```

Adding a palette in v2 = add an object to this file. No other code changes.

## 7. Testing

Verification is primarily visual in the browser (user's standard workflow). Automated tests cover only pure logic.

### Unit tests (Vitest)

- `lib/prng.ts` — `mulberry32` is deterministic: same seed → same sequence.
- `renderer/composition.ts` — `generateComposition(seed, count, palette)` is deterministic (same inputs → same output) and respects `blobCount`. All `x, y` ∈ [0, 1], `radius` ∈ [0.2, 0.5], `variantIdx` is a valid index into `palette.blobVariants`.
- `data/palettes.ts` — structural validation: each palette has a valid hex background, ≥1 variant, stops with monotonically increasing offsets ∈ [0, 1].

### Smoke tests (Vitest + jsdom or happy-dom with canvas polyfill)

- `renderer/render.ts` — does not throw for valid params; after render, the canvas has non-background pixels somewhere (blobs were drawn).
- `renderer/export.ts` — `toBlob` produces a non-empty PNG blob; filename matches the expected pattern.

### Manual verification (golden path)

1. `npm run dev` opens the app.
2. Each of the 3 palettes renders distinctly.
3. Randomize produces a new composition on each click.
4. Grain and blur sliders respond in real time.
5. Changing resolution preserves the visual look (proportions scale correctly).
6. Download PNG at 1080p and 4K → file opens outside the browser, high quality, no artifacts.

### Out of scope (v1)

- Visual regression tests
- End-to-end browser tests
- Coverage targets

## 8. Error Handling

Limited surface area; the app has minimal failure modes.

- **Invalid resolution input** (non-numeric, < 1, > 3840): clamp at the input level. No need for error UI.
- **`toBlob` failure on export** (rare, e.g. canvas too large for the browser): show a brief inline message ("Failed to export — try a smaller resolution.") and log to console. Don't crash the app.
- **Render errors:** wrap the export `render()` call in a try/catch and show the same inline message as `toBlob` failure. The preview render is best-effort — if it throws, the previous frame stays on the canvas (no clearRect before render) and the error is logged.

## 9. Open Questions / Deferred Decisions

None for v1. All scope decisions are locked.

For v2 planning (not part of this spec):
- Manual blob positioning (drag-to-place)
- Custom palettes / per-blob color picking
- Better grain (color, multi-frequency, real-film tiles)
- WebGL renderer for metaball fidelity
- Composition save/load
