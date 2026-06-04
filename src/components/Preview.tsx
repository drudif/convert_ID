import { useEffect, useRef } from 'react';
import { render } from '../renderer/render';
import type { RenderParams } from '../types';

// In "fit" mode the preview is rendered at a fast, downscaled resolution so
// live editing stays smooth. In "100%" mode it renders at the true output
// resolution so the canvas shows real 1:1 pixels (scrollable when larger than
// the viewport). Export always renders full-res regardless of zoom.
const FIT_MAX = 900;
// While playing, cap resolution harder so the per-frame render keeps up
// (mesh is light; the heatmap field is the heavy one — tuned later).
const ANIM_MAX = 640;
const DEBOUNCE_MS = 50;

export type Zoom = 'fit' | '100';

function previewParams(params: RenderParams, zoom: Zoom, cap: number): RenderParams {
  const longest = Math.max(params.width, params.height);
  const limit = zoom === '100' ? cap : Math.min(FIT_MAX, cap);
  if (longest <= limit) return params;
  const scale = limit / longest;
  return {
    ...params,
    width: Math.round(params.width * scale),
    height: Math.round(params.height * scale),
  };
}

type Props = {
  params: RenderParams;
  zoom: Zoom;
  playing: boolean;
  speed: number;
};

export function Preview({ params, zoom, playing, speed }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Animation clock lives in a ref so advancing it doesn't re-render React.
  const timeRef = useRef(0);

  // Each time playback (re)starts, rewind the clock so the animation begins
  // from the initial PNG (time 0).
  useEffect(() => {
    if (playing) timeRef.current = 0;
  }, [playing]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!playing) {
      // Paused → show the initial PNG (time 0), not a frozen mid-animation frame.
      const handle = window.setTimeout(() => {
        try {
          render(canvas, previewParams({ ...params, time: 0 }, zoom, Infinity));
        } catch (err) {
          console.error('Preview render failed', err);
        }
      }, DEBOUNCE_MS);
      return () => window.clearTimeout(handle);
    }

    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      timeRef.current += dt * speed;
      try {
        render(canvas, previewParams({ ...params, time: timeRef.current }, zoom, ANIM_MAX));
      } catch (err) {
        console.error('Preview render failed', err);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [params, zoom, playing, speed]);

  const scaled = previewParams(params, zoom, playing ? ANIM_MAX : Infinity);

  return (
    // overflow:auto + margin:auto on the canvas = centred when it fits, and
    // scrollable (no clipped edges) when it's larger than the area. Clean
    // full-bleed: nothing is overlaid on the canvas (zoom lives in the top bar).
    <div className="canvas-wrap">
      <canvas
        ref={canvasRef}
        width={scaled.width}
        height={scaled.height}
        style={zoom === 'fit' ? { maxWidth: '100%', maxHeight: '100%' } : undefined}
      />
    </div>
  );
}
