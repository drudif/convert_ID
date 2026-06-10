// Time-based morphing of the per-blob "mini" sources. Each mini wobbles around
// its base offset on a smooth periodic path, with a per-mini phase derived from
// its own base position — so the cluster's silhouette distortion stays "alive"
// (organic shape morph) instead of being frozen. Used by both renderers.

const MORPH_FREQ = 0.6;   // base angular speed of the wobble
const MORPH_GAIN = 0.4;   // wobble radius (in normalized offset units) at amp=1

/**
 * Returns the morphed [ox, oy] for a mini given its base offset, the current
 * time and the morph amplitude (0 = no morph → base offset unchanged).
 * The result is still in normalized [-~1.4, 1.4] units; callers scale it by
 * `r * offsetScale` exactly as before.
 *
 * Optional tuning (defaults reproduce the original wobble exactly):
 * - `freq`/`gain`: speed and size of the deformation.
 * - `phaseSeed`: per-blob phase so different blobs morph out of sync (variety).
 * - `richness` (0–1): blends in a faster second harmonic for quicker, less
 *   repetitive deformation — used by flowing blobs that "swim" through the field.
 */
export function morphOffset(
  ox: number, oy: number, time: number, amp: number,
  freq: number = MORPH_FREQ, gain: number = MORPH_GAIN,
  phaseSeed: number = 0, richness: number = 0,
): [number, number] {
  if (amp <= 0) return [ox, oy];
  const phase = (ox + 1) * 3.1 + (oy + 1) * 5.3 + phaseSeed;
  const w = amp * gain;
  // Wobble value at a given time. Subtracting its value at t=0 makes the morph
  // displacement EXACTLY zero at t=0, so the still (PNG/paused frame) sits at the
  // base composition — identical regardless of `amp`. That keeps the heat map and
  // mesh in register at rest (per-mode morph only diverges WHILE animating).
  const wob = (tt: number): [number, number] => {
    const t = tt * freq;
    let sx = Math.sin(t + phase);
    let cy = Math.cos(t + phase * 1.27);
    if (richness > 0) {
      const t2 = tt * freq * 2.7;
      sx = (1 - 0.45 * richness) * sx + 0.45 * richness * Math.sin(t2 + phase * 1.9);
      cy = (1 - 0.45 * richness) * cy + 0.45 * richness * Math.cos(t2 + phase * 2.3);
    }
    return [sx, cy];
  };
  const [sx, cy] = wob(time);
  const [sx0, cy0] = wob(0);
  return [ox + w * (sx - sx0), oy + w * (cy - cy0)];
}
