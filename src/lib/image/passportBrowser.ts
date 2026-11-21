// passportBrowser.ts — browser side of the passport photo maker: the model worker (public/bg/worker.js),
// canvas resizing, background compositing and JPEG sizing. The maths lives in passport.ts.

import {
  FACE_INPUT,
  compositeOnColor,
  faceToImage,
  letterbox,
  modnetInputSize,
  pickFace,
  toFaceTensor,
  toModnetTensor,
  type FaceBox,
  type Frame,
} from './passport';

type Reply = { id: number; error?: string; ok?: boolean; alpha?: Float32Array; scores?: Float32Array; boxes?: Float32Array };
type Pending = { resolve: (r: Reply) => void; reject: (e: Error) => void };

function canvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

function ctx2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas is not available in this browser.');
  return ctx;
}

function drawScaled(src: CanvasImageSource & { width: number; height: number }, w: number, h: number): HTMLCanvasElement {
  const c = canvas(w, h);
  const ctx = ctx2d(c);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

/** The two models, loaded once into a worker. Downloads ~28 MB the first time; cached after. */
export class PhotoModels {
  private worker: Worker | null = null;
  private seq = 0;
  private readonly pending = new Map<number, Pending>();

  constructor(private readonly onProgress?: (loaded: number, total: number) => void) {}

  private fail(err: Error) {
    for (const p of this.pending.values()) p.reject(err);
    this.pending.clear();
    this.worker?.terminate();
    this.worker = null;
  }

  private call(msg: Record<string, unknown>, transfer: Transferable[] = []): Promise<Reply> {
    if (!this.worker) {
      const worker = new Worker('/bg/worker.js', { type: 'module' });
      worker.onmessage = (e: MessageEvent) => {
        const d = e.data;
        if (d?.type === 'progress') return this.onProgress?.(d.loaded, d.total);
        const p = this.pending.get(d?.id);
        if (!p) return;
        this.pending.delete(d.id);
        if (d.error) p.reject(new Error(d.error));
        else p.resolve(d);
      };
      worker.onerror = (e) => {
        e.preventDefault();
        this.fail(new Error('The photo tool could not start in this browser. Try the latest Chrome, Edge, Safari or Firefox.'));
      };
      this.worker = worker;
    }
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker!.postMessage({ ...msg, id }, transfer);
    });
  }

  async load(): Promise<void> {
    await this.call({ type: 'load' });
  }

  /** Person matte at the source's size, values 0–1. */
  async matte(source: HTMLCanvasElement): Promise<Float32Array> {
    const size = modnetInputSize(source.width, source.height);
    const small = drawScaled(source, size.w, size.h);
    const data = toModnetTensor(ctx2d(small).getImageData(0, 0, size.w, size.h).data, size.w, size.h);
    const r = await this.call({ type: 'matte', data, dims: [1, 3, size.h, size.w] }, [data.buffer]);
    return upscaleAlpha(r.alpha!, size.w, size.h, source.width, source.height);
  }

  /** The main face, in source pixels, or null when none is found. */
  async face(source: HTMLCanvasElement): Promise<FaceBox | null> {
    const { scale, dx, dy } = letterbox(source.width, source.height);
    const c = canvas(FACE_INPUT.w, FACE_INPUT.h);
    const ctx = ctx2d(c);
    ctx.fillStyle = 'rgb(127,127,127)';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, dx, dy, source.width * scale, source.height * scale);
    const data = toFaceTensor(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height);
    const r = await this.call({ type: 'face', data, dims: [1, 3, FACE_INPUT.h, FACE_INPUT.w] }, [data.buffer]);
    const face = pickFace(r.scores!, r.boxes!);
    return face ? faceToImage(face, source.width, source.height) : null;
  }

  dispose(): void {
    this.fail(new Error('Closed.'));
  }
}

/** Model-size matte → source-size matte, smoothly interpolated by the canvas. */
function upscaleAlpha(alpha: Float32Array, w: number, h: number, outW: number, outH: number): Float32Array {
  const small = canvas(w, h);
  const ctx = ctx2d(small);
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const v = Math.round(Math.min(1, Math.max(0, alpha[i])) * 255);
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const d = ctx2d(drawScaled(small, outW, outH)).getImageData(0, 0, outW, outH).data;
  const out = new Float32Array(outW * outH);
  for (let i = 0; i < out.length; i++) out[i] = d[i * 4] / 255;
  return out;
}

/** The person over a plain colour, at the source's size. */
export function cutoutCanvas(source: HTMLCanvasElement, alpha: Float32Array, rgb: readonly [number, number, number]): HTMLCanvasElement {
  const c = canvas(source.width, source.height);
  const ctx = ctx2d(c);
  ctx.drawImage(source, 0, 0);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  compositeOnColor(img.data, alpha, rgb);
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Draw the framed part of `cutout` onto a w×h canvas; anything outside the photo is background. */
export function drawFrame(target: HTMLCanvasElement, cutout: HTMLCanvasElement, frame: Frame, rgb: readonly [number, number, number]): void {
  const ctx = ctx2d(target);
  ctx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
  ctx.fillRect(0, 0, target.width, target.height);
  const s = target.width / frame.w;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(cutout, -frame.x * s, -frame.y * s, cutout.width * s, cutout.height * s);
}

/** The finished photo at print size. */
export function renderPhoto(cutout: HTMLCanvasElement, frame: Frame, rgb: readonly [number, number, number], w: number, h: number): HTMLCanvasElement {
  const c = canvas(w, h);
  drawFrame(c, cutout, frame, rgb);
  return c;
}

function toJpeg(c: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not create the JPG.'))), 'image/jpeg', quality),
  );
}

/** Best-quality JPEG that fits under `maxBytes` (or quality 0.95 when there is no limit). */
export async function jpegUnder(c: HTMLCanvasElement, maxBytes: number | null): Promise<Blob> {
  const top = await toJpeg(c, 0.95);
  if (!maxBytes || top.size <= maxBytes) return top;
  let lo = 0.2;
  let hi = 0.95;
  let best = await toJpeg(c, lo);
  if (best.size > maxBytes) return best; // smallest we can make at this size
  for (let i = 0; i < 7; i++) {
    const mid = (lo + hi) / 2;
    const b = await toJpeg(c, mid);
    if (b.size <= maxBytes) {
      best = b;
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return best;
}
