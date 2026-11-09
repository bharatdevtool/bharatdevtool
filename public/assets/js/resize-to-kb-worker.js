// resize-to-kb-worker.js — module Web Worker that resizes one image at a time
// off the main thread. Images never leave the browser.

import { processToKB } from './image-utils.js';

self.onmessage = async (event) => {
  const { id, file, job } = event.data;
  try {
    const result = await processToKB(file, job);
    self.postMessage({ id, ...result });
  } catch (err) {
    self.postMessage({ id, ok: false, reason: 'decode-failed', message: String(err && err.message) });
  }
};
