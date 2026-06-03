import { useEffect, useRef } from 'react';
import { render } from '../renderer/render';
import type { RenderParams } from '../types';

// In "fit" mode the preview is rendered at a fast, downscaled resolution so
// live editing stays smooth. In "100%" mode it renders at the true output
// resolution so the canvas shows real 1:1 pixels (scrollable when larger than
// the viewport). Export always renders full-res regardless of zoom.
const FIT_MAX = 900;
const DEBOUNCE_MS = 50;

export type Zoom = 'fit' | '100';

function previewParams(params: RenderParams, zoom: Zoom): RenderParams {
  if (zoom === '100') return params;
  const longest = Math.max(params.width, params.height);
  if (longest <= FIT_MAX) return params;
  const scale = FIT_MAX / longest;
  return {
    ...params,
    width: Math.round(params.width * scale),
    height: Math.round(params.height * scale),
  };
}

type Props = { params: RenderParams; zoom: Zoom };

export function Preview({ params, zoom }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      try {
        render(canvas, previewParams(params, zoom));
      } catch (err) {
        console.error('Preview render failed', err);
      }
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [params, zoom]);

  const scaled = previewParams(params, zoom);

  return (
    // overflow:auto + margin:auto on the canvas = centred when it fits, and
    // scrollable (no clipped edges) when it's larger than the area.
    <div style={{ flex: 1, width: '100%', display: 'flex', overflow: 'auto' }}>
      <canvas
        ref={canvasRef}
        width={scaled.width}
        height={scaled.height}
        style={{
          margin: 'auto',
          ...(zoom === 'fit' ? { maxWidth: '100%', maxHeight: '100%' } : {}),
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}
      />
    </div>
  );
}
