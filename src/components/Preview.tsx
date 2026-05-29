import { useEffect, useRef } from 'react';
import { render } from '../renderer/render';
import type { RenderParams } from '../types';

const PREVIEW_MAX = 800;
const DEBOUNCE_MS = 50;

function scaleParams(params: RenderParams): RenderParams {
  const longest = Math.max(params.width, params.height);
  if (longest <= PREVIEW_MAX) return params;
  const scale = PREVIEW_MAX / longest;
  return {
    ...params,
    width: Math.round(params.width * scale),
    height: Math.round(params.height * scale),
  };
}

type Props = { params: RenderParams };

export function Preview({ params }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      try {
        render(canvas, scaleParams(params));
      } catch (err) {
        console.error('Preview render failed', err);
      }
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [params]);

  const scaled = scaleParams(params);

  return (
    <canvas
      ref={canvasRef}
      width={scaled.width}
      height={scaled.height}
      style={{
        maxWidth: '100%',
        maxHeight: '100%',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}
    />
  );
}
