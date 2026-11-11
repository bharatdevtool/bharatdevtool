// json-file.js — open a JSON file and save edits back into the same file.
//
// Chrome and Edge (desktop) expose the File System Access API: a file opened
// with the picker or dropped on the page comes with a handle we can write to,
// so "Save" updates the original file in place (the browser asks once for
// permission). Other browsers (Firefox, Safari, phones) cannot write to an
// existing file, so "Save" downloads the JSON under the original file name.
//
// Everything stays on the device. The file name is only shown in the UI and is
// never sent to analytics.

let opened = null; // { name: string, handle: FileSystemFileHandle | null }
const listeners = new Set();

/** Called with the current file (or null) whenever it changes. */
export function onOpenedFileChange(fn) {
  listeners.add(fn);
  fn(opened);
}

function setOpened(value) {
  opened = value;
  listeners.forEach((fn) => fn(opened));
}

export function getOpenedFile() {
  return opened;
}

/** Forget the file, e.g. when the input is cleared or replaced with other JSON. */
export function forgetOpenedFile() {
  if (opened) setOpened(null);
}

/** True when Save can write into the original file (not just download a copy). */
export function canSaveInPlace() {
  return !!(opened && opened.handle && typeof opened.handle.createWritable === 'function');
}

const PICKER_TYPES = [{ description: 'JSON file', accept: { 'application/json': ['.json'] } }];

/**
 * Ask the user for a file. Uses the File System Access picker when available
 * (so the file can be saved back), otherwise `fallback()` (the hidden <input>).
 * Resolves to the file's text, or null if the user cancelled.
 */
export async function pickJsonFile(fallback) {
  if (typeof window.showOpenFilePicker !== 'function') {
    fallback();
    return null;
  }
  let handle;
  try {
    [handle] = await window.showOpenFilePicker({ types: PICKER_TYPES, multiple: false });
  } catch (err) {
    if (err && err.name === 'AbortError') return null; // user closed the picker
    fallback(); // e.g. blocked in an iframe
    return null;
  }
  const file = await handle.getFile();
  const text = await file.text();
  setOpened({ name: file.name, handle });
  return text;
}

/** A file chosen with the plain <input type="file"> (no handle: Save downloads). */
export async function readInputFile(file) {
  const text = await file.text();
  setOpened({ name: file.name, handle: null });
  return text;
}

/**
 * Read a dropped file. Must be called synchronously inside the drop event:
 * the browser only hands out the file handle during the event itself.
 * Resolves to the text, or null if nothing usable was dropped.
 */
export function readDroppedFile(event) {
  const dt = event.dataTransfer;
  const file = dt && dt.files && dt.files[0];
  if (!file) return null;
  const item = [...(dt.items || [])].find((i) => i.kind === 'file');
  const handlePromise =
    item && typeof item.getAsFileSystemHandle === 'function'
      ? item.getAsFileSystemHandle().catch(() => null)
      : Promise.resolve(null);
  return Promise.all([file.text(), handlePromise]).then(([text, handle]) => {
    setOpened({ name: file.name, handle: handle && handle.kind === 'file' ? handle : null });
    return text;
  });
}

/**
 * Save `text` to the opened file. Resolves to 'saved' (written in place),
 * 'downloaded' (fallback copy) or 'cancelled' (permission refused).
 */
export async function saveToOpenedFile(text) {
  // Snapshot now: another file could be opened while the permission prompt is up.
  const file = opened;
  if (!file) throw new Error('No file is open');
  const { name, handle } = file;
  if (handle && typeof handle.createWritable === 'function') {
    try {
      if (typeof handle.queryPermission === 'function') {
        let perm = await handle.queryPermission({ mode: 'readwrite' });
        if (perm !== 'granted') perm = await handle.requestPermission({ mode: 'readwrite' });
        if (perm !== 'granted') return 'cancelled';
      }
      const writable = await handle.createWritable();
      await writable.write(text);
      await writable.close();
      return 'saved';
    } catch (err) {
      if (err && (err.name === 'NotAllowedError' || err.name === 'AbortError')) return 'cancelled';
      // File moved or deleted, or the browser refused: fall back to a download.
    }
  }
  downloadText(text, name);
  return 'downloaded';
}

export function downloadText(text, filename) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
