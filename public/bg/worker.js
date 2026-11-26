// Passport photo maker: runs the person-matting model (MODNet) and the face detector in a module
// worker, so the page stays responsive. Everything runs in this browser; no photo is uploaded.
// Messages in:  { id, type: 'load' } | { id, type: 'matte' | 'face', data: Float32Array, dims }
// Messages out: { type: 'progress', loaded, total } | { id, ok } | { id, alpha } | { id, scores, boxes } | { id, error }
import * as ort from './ort.wasm.bundle.min.mjs';

const BASE = new URL('./', import.meta.url).href;
const FILES = {
  wasm: { url: BASE + 'ort-wasm-simd-threaded.wasm', size: 14848852 },
  matte: { url: BASE + 'modnet-fp16.onnx', size: 12984781 },
  face: { url: BASE + 'face-rfb320.onnx', size: 1270727 },
};

ort.env.wasm.numThreads = 1; // threads need cross-origin isolation, which this site does not use
ort.env.wasm.wasmPaths = BASE;

let loading = null;
const sessions = {};

/** Fetch every file with one combined progress count (the browser cache serves repeat visits). */
async function fetchAll() {
  const loaded = { wasm: 0, matte: 0, face: 0 };
  const total = FILES.wasm.size + FILES.matte.size + FILES.face.size;
  const report = () => self.postMessage({ type: 'progress', loaded: loaded.wasm + loaded.matte + loaded.face, total });
  const get = async (key) => {
    const res = await fetch(FILES[key].url);
    if (!res.ok || !res.body) throw new Error(`Could not download the ${key} file (${res.status}).`);
    const reader = res.body.getReader();
    const parts = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(value);
      size += value.byteLength;
      loaded[key] = Math.min(size, FILES[key].size);
      report();
    }
    const bytes = new Uint8Array(size);
    let at = 0;
    for (const p of parts) {
      bytes.set(p, at);
      at += p.byteLength;
    }
    return bytes;
  };
  const [wasm, matte, face] = await Promise.all([get('wasm'), get('matte'), get('face')]);
  return { wasm, matte, face };
}

async function load() {
  const files = await fetchAll();
  ort.env.wasm.wasmBinary = files.wasm.buffer;
  const options = { executionProviders: ['wasm'], graphOptimizationLevel: 'all' };
  sessions.matte = await ort.InferenceSession.create(files.matte, options);
  sessions.face = await ort.InferenceSession.create(files.face, options);
}

self.onmessage = async (event) => {
  const { id, type, data, dims } = event.data || {};
  try {
    if (!loading) {
      loading = load().catch((err) => {
        loading = null; // let the next attempt download again
        throw err;
      });
    }
    await loading;
    if (type === 'load') return self.postMessage({ id, ok: true });
    const session = sessions[type];
    if (!session) throw new Error('Unknown request.');
    const out = await session.run({ [session.inputNames[0]]: new ort.Tensor('float32', data, dims) });
    if (type === 'matte') {
      const alpha = Float32Array.from(out[session.outputNames[0]].data);
      self.postMessage({ id, alpha }, [alpha.buffer]);
    } else {
      const scores = Float32Array.from(out.scores.data);
      const boxes = Float32Array.from(out.boxes.data);
      self.postMessage({ id, scores, boxes }, [scores.buffer, boxes.buffer]);
    }
  } catch (err) {
    self.postMessage({ id, error: String((err && err.message) || err) });
  }
};
