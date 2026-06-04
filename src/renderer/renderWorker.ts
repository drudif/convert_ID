// Web Worker: renders animation frames off the main thread for fast offline
// export. It runs the EXACT same `render()` as the preview/PNG, so the output is
// pixel-identical — only parallelised across CPU cores. It builds the VideoFrame
// here and TRANSFERS it to the main thread (ownership moves), so there is no
// shared/reused buffer the encoder could read after it's freed.
import { render } from './render';
import type { RenderParams } from '../types';

type InitMsg = { type: 'init'; base: RenderParams; fps: number };
type FrameMsg = { type: 'frame'; index: number };

const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<InitMsg | FrameMsg>) => void) | null;
  postMessage: (msg: unknown, transfer?: Transferable[]) => void;
};
const VideoFrameCtor = (self as unknown as { VideoFrame: typeof VideoFrame }).VideoFrame;

let base: RenderParams | null = null;
let fps = 30;
let canvas: OffscreenCanvas | null = null;

ctx.onmessage = (e) => {
  const msg = e.data;
  if (msg.type === 'init') {
    base = msg.base;
    fps = msg.fps;
    canvas = new OffscreenCanvas(base.width, base.height);
    return;
  }
  if (msg.type === 'frame') {
    if (!base || !canvas) return;
    const { index } = msg;
    // OffscreenCanvas shares the 2D API render() uses; cast satisfies the type.
    render(canvas as unknown as HTMLCanvasElement, { ...base, time: index / fps });
    const frameDurUs = 1e6 / fps;
    const frame = new VideoFrameCtor(canvas, {
      timestamp: Math.round(index * frameDurUs),
      duration: Math.round(frameDurUs),
    });
    // Transfer the VideoFrame: it's detached from this canvas, so re-rendering
    // the next frame into the same canvas can't corrupt an in-flight frame.
    ctx.postMessage({ type: 'frame', index, frame }, [frame as unknown as Transferable]);
  }
};
