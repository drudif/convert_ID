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
 * each frame is rendered deterministically at `frame / fps` and encoded via
 * WebCodecs into an in-memory MP4 — smooth and exact regardless of how slow a
 * single frame is to draw (no real-time pressure). Returns the MP4 Blob.
 */
export async function exportMp4(
  base: RenderParams,
  width: number,
  height: number,
  durationSec: number,
  fps: number,
  onProgress: VideoProgress,
  bitrate: number = 8_000_000,
): Promise<Blob> {
  const VideoEncoderCtor = (globalThis as { VideoEncoder?: typeof VideoEncoder }).VideoEncoder;
  const VideoFrameCtor = (globalThis as { VideoFrame?: typeof VideoFrame }).VideoFrame;
  if (!VideoEncoderCtor || !VideoFrameCtor) {
    throw new Error('Este navegador não suporta WebCodecs (export MP4). Use Chrome ou Safari recentes.');
  }

  // Try a few H.264 profiles/levels — browsers/hardware vary in what their
  // encoder accepts. Use the first one that reports support.
  const candidates = [
    'avc1.640028', // High @ 4.0
    'avc1.4d4028', // Main @ 4.0
    'avc1.420028', // Baseline @ 4.0
    'avc1.640032', // High @ 5.0 (headroom for 60fps / larger)
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

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const totalFrames = Math.max(1, Math.round(durationSec * fps));
  const frameDurUs = 1e6 / fps;
  const gop = Math.max(1, Math.round(fps * 2)); // keyframe every ~2s

  for (let i = 0; i < totalFrames; i++) {
    if (encodeError) throw encodeError;
    render(canvas, { ...base, width, height, time: i / fps });
    const frame = new VideoFrameCtor(canvas, {
      timestamp: Math.round(i * frameDurUs),
      duration: Math.round(frameDurUs),
    });
    encoder.encode(frame, { keyFrame: i % gop === 0 });
    frame.close();
    onProgress(i + 1, totalFrames);
    // Yield so the UI stays responsive and the encoder queue can drain.
    if (encoder.encodeQueueSize > 8 || i % 4 === 0) {
      await new Promise<void>((r) => setTimeout(r, 0));
    }
  }

  await encoder.flush();
  muxer.finalize();
  encoder.close();
  if (encodeError) throw encodeError;

  return new Blob([muxer.target.buffer], { type: 'video/mp4' });
}
