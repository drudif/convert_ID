import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import { render } from './render';
import type { RenderParams } from '../types';

export type VideoProgress = (done: number, total: number) => void;

// 1080-tier output dimensions matching the current orientation.
export function tier1080(width: number, height: number): { width: number; height: number } {
  if (width > height) return { width: 1920, height: 1080 };
  if (width < height) return { width: 1080, height: 1920 };
  return { width: 1080, height: 1080 };
}

/**
 * Offline MP4 (H.264) export. Because `render` is a pure function of `time`,
 * each frame is rendered deterministically at `frame / fps`. The heavy per-pixel
 * render is parallelised across a pool of Web Workers (when supported) and the
 * encoder (WebCodecs) runs on the main thread, encoding frames strictly in order.
 * Output is byte-identical to the single-thread path — only faster. Returns the
 * MP4 Blob.
 */
export async function exportMp4(
  base: RenderParams,
  width: number,
  height: number,
  durationSec: number,
  fps: number,
  onProgress: VideoProgress,
  bitrate: number = 8_000_000,
  signal?: AbortSignal,
): Promise<Blob> {
  const VideoEncoderCtor = (globalThis as { VideoEncoder?: typeof VideoEncoder }).VideoEncoder;
  const VideoFrameCtor = (globalThis as { VideoFrame?: typeof VideoFrame }).VideoFrame;
  if (!VideoEncoderCtor || !VideoFrameCtor) {
    throw new Error('Este navegador não suporta WebCodecs (export MP4). Use Chrome ou Safari recentes.');
  }

  // Try a few H.264 profiles/levels — browsers/hardware vary in what their
  // encoder accepts. 4K@30 needs level ≥ 5.1, so prefer the high levels when the
  // output is large; otherwise the 4.0 levels (1080) first. First supported wins.
  const big = Math.max(width, height) >= 2000;
  const candidates = big
    ? [
        'avc1.640034', // High @ 5.2
        'avc1.640033', // High @ 5.1 (covers 4K@30)
        'avc1.640032', // High @ 5.0
        'avc1.640028', // High @ 4.0 (fallback)
      ]
    : [
        'avc1.640028', // High @ 4.0
        'avc1.4d4028', // Main @ 4.0
        'avc1.420028', // Baseline @ 4.0
        'avc1.640032', // High @ 5.0
      ];
  let config: VideoEncoderConfig | null = null;
  const baseCfg = { width, height, bitrate, framerate: fps };
  for (const codec of candidates) {
    const cfg: VideoEncoderConfig = { codec, ...baseCfg };
    try {
      const support = await VideoEncoderCtor.isConfigSupported(cfg);
      if (support.supported) { config = cfg; break; }
    } catch {
      /* try next */
    }
  }
  if (!config) {
    throw new Error('Nenhum codec H.264 suportado pelo WebCodecs deste navegador para 1080.');
  }

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width, height, frameRate: fps },
    fastStart: 'in-memory',
  });
  let encodeError: unknown = null;
  const encoder = new VideoEncoderCtor({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => { encodeError = e; },
  });
  encoder.configure(config);

  const totalFrames = Math.max(1, Math.round(durationSec * fps));
  const frameDurUs = 1e6 / fps;
  const gop = Math.max(1, Math.round(fps * 2)); // keyframe every ~2s
  const workerBase: RenderParams = { ...base, width, height };

  // Encode a ready VideoFrame (in order) and close it.
  const encodeReady = (index: number, frame: VideoFrame) => {
    encoder.encode(frame, { keyFrame: index % gop === 0 });
    frame.close();
  };

  const useWorkers =
    typeof Worker !== 'undefined' &&
    typeof OffscreenCanvas !== 'undefined';

  try {
    if (useWorkers) {
      await renderParallel(workerBase, fps, totalFrames, encodeReady, onProgress, () => encodeError, signal);
    } else {
      await renderSequential(
        workerBase, fps, totalFrames, encodeReady, onProgress, () => encodeError,
        width, height, VideoFrameCtor, frameDurUs, signal,
      );
    }
    await encoder.flush();
  } catch (e) {
    try { encoder.close(); } catch { /* already closed */ }
    throw e;
  }

  muxer.finalize();
  encoder.close();
  if (encodeError) throw encodeError;

  return new Blob([muxer.target.buffer], { type: 'video/mp4' });
}

function abortError(): Error {
  const e = new Error('Export cancelado.');
  e.name = 'AbortError';
  return e;
}

// --- Parallel rendering across a Web Worker pool -----------------------------
// Workers render frames (out of order); the main thread buffers and encodes them
// strictly in order. Dispatch is throttled so no more than MAX_AHEAD frames are
// rendered ahead of the encode cursor, bounding memory.
function renderParallel(
  base: RenderParams,
  fps: number,
  total: number,
  encodeReady: (index: number, frame: VideoFrame) => void,
  onProgress: VideoProgress,
  getEncodeError: () => unknown,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) { reject(abortError()); return; }
    const N = Math.max(1, Math.min((navigator.hardwareConcurrency || 4) - 1, 6));
    const MAX_AHEAD = N * 2;
    const workers: Worker[] = [];
    const idle: Worker[] = [];
    const pending = new Map<number, VideoFrame>();
    let nextDispatch = 0;
    let nextEncode = 0;
    let done = 0;
    let finished = false;

    const onAbort = () => fail(abortError());
    signal?.addEventListener('abort', onAbort, { once: true });
    const cleanup = () => {
      signal?.removeEventListener('abort', onAbort);
      workers.forEach((w) => w.terminate());
      pending.forEach((f) => f.close());
      pending.clear();
    };
    const finish = () => { if (finished) return; finished = true; cleanup(); resolve(); };
    const fail = (e: unknown) => {
      if (finished) return;
      finished = true;
      cleanup();
      reject(e instanceof Error ? e : new Error(String(e)));
    };

    const drainEncode = () => {
      while (pending.has(nextEncode)) {
        const frame = pending.get(nextEncode)!;
        pending.delete(nextEncode);
        try {
          encodeReady(nextEncode, frame);
        } catch (e) {
          frame.close();
          fail(e);
          return;
        }
        nextEncode++;
        done++;
        onProgress(done, total);
      }
      if (nextEncode >= total) finish();
    };

    const pump = () => {
      while (idle.length && nextDispatch < total && nextDispatch - nextEncode < MAX_AHEAD) {
        const w = idle.pop()!;
        w.postMessage({ type: 'frame', index: nextDispatch++ });
      }
    };

    for (let k = 0; k < N; k++) {
      const w = new Worker(new URL('./renderWorker.ts', import.meta.url), { type: 'module' });
      w.onmessage = (e: MessageEvent) => {
        if (finished) return;
        const err = getEncodeError();
        if (err) { fail(err); return; }
        const data = e.data as { index: number; frame: VideoFrame };
        pending.set(data.index, data.frame);
        idle.push(w);
        drainEncode();
        pump();
      };
      w.onerror = (ev) => fail((ev as ErrorEvent).error ?? new Error((ev as ErrorEvent).message || 'worker error'));
      w.postMessage({ type: 'init', base, fps });
      workers.push(w);
      idle.push(w);
    }
    pump();
  });
}

// --- Single-thread fallback (no OffscreenCanvas / Worker support) ------------
async function renderSequential(
  base: RenderParams,
  fps: number,
  total: number,
  encodeReady: (index: number, frame: VideoFrame) => void,
  onProgress: VideoProgress,
  getEncodeError: () => unknown,
  width: number,
  height: number,
  VideoFrameCtor: typeof VideoFrame,
  frameDurUs: number,
  signal?: AbortSignal,
): Promise<void> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  for (let i = 0; i < total; i++) {
    if (signal?.aborted) throw abortError();
    const err = getEncodeError();
    if (err) throw err;
    render(canvas, { ...base, time: i / fps });
    const frame = new VideoFrameCtor(canvas, {
      timestamp: Math.round(i * frameDurUs),
      duration: Math.round(frameDurUs),
    });
    encodeReady(i, frame);
    onProgress(i + 1, total);
    if (i % 4 === 0) await new Promise<void>((r) => setTimeout(r, 0));
  }
}
