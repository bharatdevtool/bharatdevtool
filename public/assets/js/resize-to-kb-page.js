// resize-to-kb-page.js — UI for the Resize Image to KB pages (the main page and the
// generated per-size / per-exam pages share it). Images never leave the browser.
// Telemetry carries fixed labels and counts only: never names, file names or contents.

import { EXAM_GROUPS, PRESETS_LAST_CHECKED, getGroup, guessDoc, inkLines, rangeText, dimsText } from './exam-presets.js';
import { formatBytes, processToKB, createZip, downloadBlob } from './image-utils.js';
import { checkOutput, toPixels, formatPhotoDate } from './kb-checks.js';

const PAGE_NAME = 'Resize Image to KB';
const MAX_FILES = 30;
const CUSTOM_ID = 'custom';
const EXAM_MAX_SIDE = 1000;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const isHeic = (f) => /image\/hei[cf]/.test(f.type) || /\.hei[cf]$/i.test(f.name);

/** Page preset from the generated pages: { group, doc?, stamp?, clean? }. */
const PAGE = (() => {
  try {
    return JSON.parse(document.getElementById('kbPage')?.textContent || '{}');
  } catch {
    return {};
  }
})();

function track(name, params) {
  if (window.Analytics) window.Analytics.track(name, Object.assign({ page: PAGE_NAME }, params || {}));
}
function reportError(err, operation) {
  if (window.Sentry) window.Sentry.captureException(err, { tags: { operation } });
}
function showToast(message, type) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast ' + (type || 'info');
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 60);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 350);
  }, 3500);
}
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
const $ = (id) => document.getElementById(id);

// ── Processing: Web Worker when available, main thread otherwise ──────────
let worker = null;
let nextJobId = 0;
const pending = new Map();
if (typeof OffscreenCanvas !== 'undefined' && typeof Worker !== 'undefined') {
  try {
    worker = new Worker(new URL('./resize-to-kb-worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      pending.delete(e.data.id);
      p.resolve(e.data);
    };
    worker.onerror = (e) => {
      // Module workers unsupported (older browsers): finish on the main thread.
      e.preventDefault();
      worker.terminate();
      worker = null;
      pending.forEach((p) => processToKB(p.file, p.job).then(p.resolve, p.reject));
      pending.clear();
    };
  } catch {
    worker = null;
  }
}
function runJob(file, job) {
  if (!worker) return processToKB(file, job);
  return new Promise((resolve, reject) => {
    const id = ++nextJobId;
    pending.set(id, { resolve, reject, file, job });
    worker.postMessage({ id, file, job });
  });
}

// ── State ─────────────────────────────────────────────────────────────────
const state = {
  groupId: 'banking',
  /** Target for "Any form: exact size". */
  sizeDoc: '20kb',
  stamp: { on: false, name: '', date: formatPhotoDate(new Date()) },
  clean: true,
  rows: [],
};
let nextRowId = 0;
let queue = Promise.resolve();

const currentGroup = () => (state.groupId === CUSTOM_ID ? null : getGroup(state.groupId));
const isSizeGroup = () => state.groupId === 'size' || state.groupId === CUSTOM_ID;

function docFor(row) {
  const group = currentGroup();
  if (!group) return null;
  return group.docs.find((d) => d.id === row.docId) || group.docs[0];
}

/** Which kind of document a row is (drives clean-up and the name/date band). */
function kindFor(row) {
  if (isSizeGroup()) return PAGE.clean ? 'signature' : 'photo';
  return docFor(row)?.kind || 'photo';
}

function customSpec() {
  const minKB = Math.max(0, Number($('customMin').value) || 0);
  const maxKB = Math.max(1, Number($('customMax').value) || 50);
  const unit = $('customUnit').value;
  const dpi = Math.max(50, Number($('customDpi').value) || 200);
  const width = toPixels(Number($('customWidth').value), unit, dpi) || undefined;
  const height = toPixels(Number($('customHeight').value), unit, dpi) || undefined;
  const hasBox = Boolean(width && height);
  return {
    minKB: Math.min(minKB, maxKB - 1),
    maxKB,
    width: hasBox ? width : undefined,
    height: hasBox ? height : undefined,
    fit: hasBox ? $('customFit').value : 'none',
  };
}

/** Limits for a row: preset doc, or the custom panel. */
function specFor(row) {
  const doc = docFor(row);
  if (!doc) return customSpec();
  return { minKB: doc.minKB, maxKB: doc.maxKB, width: doc.width, height: doc.height, fit: doc.fit, aspect: doc.aspect, stamp: doc.stamp };
}

function jobFor(row) {
  const spec = specFor(row);
  const kind = kindFor(row);
  const stampOn = state.stamp.on && kind === 'photo';
  return {
    minKB: spec.minKB,
    maxKB: spec.maxKB,
    width: spec.width,
    height: spec.height,
    fit: spec.fit,
    aspect: spec.width ? undefined : spec.aspect,
    // Exam documents without exact pixels: 1000 px is plenty, and sharper per KB than a huge image.
    maxSide: isSizeGroup() ? undefined : EXAM_MAX_SIDE,
    edits: {
      rotate: row.edits.rotate,
      crop: row.edits.crop,
      clean: state.clean && kind !== 'photo',
      stamp: stampOn ? { name: state.stamp.name, date: state.stamp.date } : null,
    },
  };
}

// ── Queue: one image at a time keeps memory low on phones ─────────────────
function schedule(row) {
  row.version += 1;
  const version = row.version;
  row.status = 'queued';
  renderRow(row);
  queue = queue.then(() => {
    if (row.removed || row.version !== version) return;
    row.status = 'working';
    renderRow(row);
    const job = jobFor(row);
    return runJob(row.file, job)
      .then((res) => {
        if (row.removed || row.version !== version) return;
        if (row.result && row.result.url) URL.revokeObjectURL(row.result.url);
        if (res.ok) {
          row.status = 'done';
          row.result = { blob: res.blob, url: URL.createObjectURL(res.blob), width: res.width, height: res.height, padded: res.padded, stamped: res.stamped, job };
        } else {
          row.status = 'error';
          row.result = null;
          row.error = res.reason !== 'too-large'
            ? isHeic(row.file)
              ? 'This browser can’t open iPhone (HEIC) photos. Open this page in Safari, or set iPhone Settings → Camera → Formats → Most Compatible.'
              : 'Could not read this image. Try saving it as JPG first.'
            : job.width
              ? `Could not get under ${job.maxKB} KB at ${job.width}×${job.height} px. Try cropping closer.`
              : `Could not get under ${job.maxKB} KB. Try a larger size limit.`;
        }
        track('image_kb_processed', { group: state.groupId, doc: row.docId || CUSTOM_ID, ok: res.ok, padded: Boolean(res.padded), stamped: Boolean(res.stamped), cleaned: Boolean(job.edits.clean) });
        renderRow(row);
        updateDownloadAll();
      })
      .catch((err) => {
        row.status = 'error';
        row.error = 'Something went wrong with this image.';
        reportError(err, 'resize_to_kb');
        renderRow(row);
      });
  });
}

// ── Rendering ─────────────────────────────────────────────────────────────
function outputName(row) {
  const group = currentGroup();
  if (!group || group.id === 'size') {
    const base = row.file.name.replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '-').slice(0, 40) || 'image';
    return base + '-' + row.result.job.maxKB + 'kb.jpg';
  }
  const sameDoc = state.rows.filter((r) => r.docId === row.docId && r.status === 'done');
  const index = sameDoc.indexOf(row);
  return group.id + '-' + row.docId + (index > 0 ? '-' + (index + 1) : '') + '.jpg';
}

function renderChecks(row) {
  const r = row.result;
  const spec = specFor(row);
  const checks = checkOutput(
    { bytes: r.blob.size, width: r.width, height: r.height, mime: r.blob.type, stamped: r.stamped },
    { ...spec, aspect: spec.width ? undefined : spec.aspect },
  );
  const list = el('ul', 'kb-checks mt-2');
  list.setAttribute('aria-label', 'Will the form accept it?');
  checks.forEach((c) => {
    const li = el('li', c.ok ? 'ok' : 'bad');
    li.appendChild(el('span', 'kb-check-icon', c.ok ? '✓' : '!'));
    li.appendChild(el('span', '', c.label));
    list.appendChild(li);
  });
  if (r.padded) list.appendChild(el('li', 'note', 'Padded to reach the minimum size (the picture is unchanged).'));
  return list;
}

function renderRow(row) {
  const card = row.card;
  card.innerHTML = '';

  const preview = el('img', 'thumb');
  preview.src = row.status === 'done' ? row.result.url : row.srcUrl;
  preview.alt = row.status === 'done' ? 'Resized result' : '';
  card.appendChild(preview);

  const info = el('div', 'flex-1 min-w-0');
  info.appendChild(el('p', 'text-sm font-medium text-gray-900 dark:text-white truncate', row.file.name));
  info.appendChild(el('p', 'text-xs text-gray-500 dark:text-gray-400', 'Original: ' + formatBytes(row.file.size) + (row.width ? ' · ' + row.width + '×' + row.height + ' px' : '')));

  const group = currentGroup();
  if (group && group.id !== 'size' && group.docs.length > 1) {
    const select = el('select', 'mt-2 max-w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white');
    select.setAttribute('aria-label', 'Document type');
    group.docs.forEach((d) => {
      const opt = el('option', '', `${d.label} (${rangeText(d)})`);
      opt.value = d.id;
      opt.selected = d.id === row.docId;
      select.appendChild(opt);
    });
    select.addEventListener('change', function () {
      row.docId = this.value;
      schedule(row);
    });
    info.appendChild(select);
  }

  if (row.status === 'queued' || row.status === 'working') info.appendChild(el('p', 'text-xs mt-2 text-gray-500', row.status === 'queued' ? 'Waiting…' : 'Resizing…'));
  else if (row.status === 'error') info.appendChild(el('p', 'text-xs mt-2 status-error', row.error));
  else if (row.status === 'done') info.appendChild(renderChecks(row));
  card.appendChild(info);

  // Phones: buttons on their own full-width line under the details.
  const actions = el('div', 'flex items-center gap-2 w-full sm:w-auto');
  if (row.status === 'done') {
    const dl = el('button', 'flex-1 sm:flex-none px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium', 'Download');
    dl.addEventListener('click', () => {
      downloadBlob(row.result.blob, outputName(row));
      track('image_kb_download', { group: state.groupId, doc: row.docId || CUSTOM_ID });
      if (window.BDTShare) window.BDTShare.successPrompt($('resultsList'), 'Photo ready for your form! Friends filling the same form? Share this free tool.');
    });
    actions.appendChild(dl);
  }
  if (row.width) {
    const edit = el('button', 'flex-1 sm:flex-none px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm font-medium', 'Crop / rotate');
    edit.addEventListener('click', () => openEditor(row));
    actions.appendChild(edit);
  }
  const remove = el('button', 'px-2 py-2 text-gray-400 hover:text-red-500 text-lg leading-none', '×');
  remove.setAttribute('aria-label', 'Remove image');
  remove.addEventListener('click', () => removeRow(row));
  actions.appendChild(remove);
  card.appendChild(actions);
}

function updateDownloadAll() {
  const done = state.rows.filter((r) => r.status === 'done');
  $('downloadAllBtn').disabled = done.length === 0;
  $('resultsSection').classList.toggle('hidden', state.rows.length === 0);
}

// ── Adding / removing ─────────────────────────────────────────────────────
function readDimensions(row) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      row.width = img.naturalWidth;
      row.height = img.naturalHeight;
      // Lines of writing: tell a signature from a declaration of the same shape.
      try {
        const w = 200;
        const h = Math.max(1, Math.round((w * row.height) / row.width));
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, w, h);
        row.lines = inkLines(ctx.getImageData(0, 0, w, h).data, w, h);
      } catch {
        row.lines = undefined;
      }
      resolve();
    };
    img.onerror = () => resolve();
    img.src = row.srcUrl;
  });
}

function addFiles(fileList) {
  let files = Array.from(fileList).filter((f) => IMAGE_TYPES.includes(f.type) || isHeic(f));
  if (!files.length) {
    showToast('Please choose JPG, PNG, WebP or iPhone (HEIC) photos.', 'error');
    return;
  }
  const room = MAX_FILES - state.rows.length;
  if (files.length > room) {
    showToast('Up to ' + MAX_FILES + ' images at a time.', 'error');
    files = files.slice(0, Math.max(0, room));
  }
  const list = $('resultsList');
  files.forEach((file) => {
    const row = { id: ++nextRowId, file, srcUrl: URL.createObjectURL(file), docId: null, status: 'queued', result: null, version: 0, removed: false, edits: { rotate: 0, crop: null } };
    row.card = el('div', 'result-card p-4 flex flex-wrap sm:flex-nowrap items-start gap-x-4 gap-y-3');
    list.appendChild(row.card);
    state.rows.push(row);
    readDimensions(row).then(() => {
      row.docId = defaultDocFor(row);
      schedule(row);
    });
  });
  updateDownloadAll();
  track('image_kb_files_added', { count: files.length, group: state.groupId, heic: files.some(isHeic) });
  $('resultsSection').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function defaultDocFor(row) {
  const group = currentGroup();
  if (!group) return null;
  if (group.id === 'size') return state.sizeDoc;
  return guessDoc(group, row.width || 1, row.height || 1, row.lines);
}

function removeRow(row) {
  row.removed = true;
  URL.revokeObjectURL(row.srcUrl);
  if (row.result && row.result.url) URL.revokeObjectURL(row.result.url);
  row.card.remove();
  state.rows = state.rows.filter((r) => r !== row);
  updateDownloadAll();
}

function clearAll() {
  state.rows.slice().forEach(removeRow);
  $('fileInput').value = '';
}

async function downloadAll() {
  const done = state.rows.filter((r) => r.status === 'done');
  if (!done.length) return;
  const files = [];
  for (const row of done) files.push({ name: outputName(row), data: new Uint8Array(await row.result.blob.arrayBuffer()) });
  downloadBlob(new Blob([createZip(files)], { type: 'application/zip' }), 'resized-images.zip');
  track('image_kb_download_all', { count: done.length, group: state.groupId });
}

// ── Form choice + options ─────────────────────────────────────────────────
function setGroup(id) {
  state.groupId = id;
  const group = currentGroup();
  const info = $('groupInfo');
  info.innerHTML = '';
  $('customPanel').classList.toggle('hidden', id !== CUSTOM_ID);
  $('sizeChips').classList.toggle('hidden', id !== 'size');
  if (group && group.id !== 'size') {
    info.appendChild(document.createTextNode(group.exams + '. ' + (group.note ? group.note + ' ' : '')));
    if (group.officialUrl) {
      const a = el('a', 'text-blue-600 dark:text-blue-400 hover:underline', 'Check the official site');
      a.href = group.officialUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      info.appendChild(a);
      info.appendChild(document.createTextNode(' for your cycle’s exact limits.'));
    }
  } else if (group) {
    info.textContent = 'Pick the size your form allows. Your photo keeps its shape; only the file gets smaller.';
  } else {
    info.textContent = 'Set your own size range. Leave width and height empty to keep the original shape.';
  }
  updateOptions();
  state.rows.forEach((row) => {
    row.docId = defaultDocFor(row);
    schedule(row);
  });
}

/** Show the name/date and clean-up options only where they apply. */
function updateOptions() {
  const group = currentGroup();
  const docs = group ? group.docs : [];
  const hasPhoto = isSizeGroup() || docs.some((d) => d.kind === 'photo');
  const hasSign = isSizeGroup() ? Boolean(PAGE.clean) : docs.some((d) => d.kind !== 'photo');
  $('stampOption').classList.toggle('hidden', !hasPhoto || Boolean(PAGE.clean));
  $('cleanOption').classList.toggle('hidden', !hasSign);
  const stampDoc = docs.find((d) => d.stamp);
  $('stampHint').textContent = stampDoc
    ? stampDoc.stamp === 'required'
      ? `${group.short} asks for your name and the photo date on the photo.`
      : `Many ${group.short} guides ask for your name and the photo date at the bottom of the photo.`
    : 'Some forms (UPSC and several state exams) ask for this.';
  $('optionsPanel').classList.toggle('hidden', $('stampOption').classList.contains('hidden') && $('cleanOption').classList.contains('hidden'));
}

function setSizeDoc(id) {
  state.sizeDoc = id;
  document.querySelectorAll('#sizeChips [data-size]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.size === id)));
  if (state.groupId === 'size') state.rows.forEach((row) => { row.docId = id; schedule(row); });
}

function rescheduleAll() {
  state.rows.forEach(schedule);
}

// ── Crop / rotate editor ──────────────────────────────────────────────────
const editor = { row: null, rotate: 0, crop: null, aspect: null, bitmap: null, scale: 1, drag: null };

/** Required shape for a row as width/height, or null when any shape is fine. */
function shapeFor(row) {
  const spec = specFor(row);
  if (spec.width && spec.height && spec.fit === 'cover') return spec.width / spec.height;
  if (spec.aspect) return spec.aspect;
  return null;
}

async function openEditor(row) {
  editor.row = row;
  editor.rotate = row.edits.rotate || 0;
  editor.crop = row.edits.crop ? { ...row.edits.crop } : null;
  editor.aspect = shapeFor(row);
  try {
    editor.bitmap = await createImageBitmap(row.file, { imageOrientation: 'from-image' });
  } catch {
    showToast('This image can’t be edited in this browser.', 'error');
    return;
  }
  $('editLock').checked = Boolean(editor.aspect);
  $('editLockRow').classList.toggle('hidden', !editor.aspect);
  $('editFaceHint').classList.toggle('hidden', kindFor(row) !== 'photo');
  $('editDialog').showModal();
  drawEditor();
  track('image_kb_editor_open', { group: state.groupId });
}

function rotatedSize() {
  const b = editor.bitmap;
  return editor.rotate % 180 ? { w: b.height, h: b.width } : { w: b.width, h: b.height };
}

/** Largest centred crop with the locked shape (in fractions of the rotated image). */
function defaultCrop() {
  const { w, h } = rotatedSize();
  if (!editor.aspect || !$('editLock').checked) return { x: 0, y: 0, w: 1, h: 1 };
  const box = w / h > editor.aspect ? { cw: h * editor.aspect, ch: h } : { cw: w, ch: w / editor.aspect };
  return { x: (1 - box.cw / w) / 2, y: (1 - box.ch / h) / 2, w: box.cw / w, h: box.ch / h };
}

function drawEditor() {
  const canvas = $('editCanvas');
  const { w, h } = rotatedSize();
  const stage = $('editStage');
  const maxW = Math.min(stage.clientWidth || 560, 720);
  const maxH = Math.max(240, Math.min(window.innerHeight * 0.55, 560));
  editor.scale = Math.min(maxW / w, maxH / h, 1);
  canvas.width = Math.round(w * editor.scale);
  canvas.height = Math.round(h * editor.scale);
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.scale(editor.scale, editor.scale);
  const b = editor.bitmap;
  if (editor.rotate === 90) { ctx.translate(w, 0); ctx.rotate(Math.PI / 2); }
  else if (editor.rotate === 180) { ctx.translate(w, h); ctx.rotate(Math.PI); }
  else if (editor.rotate === 270) { ctx.translate(0, h); ctx.rotate(-Math.PI / 2); }
  ctx.drawImage(b, 0, 0);
  ctx.restore();
  if (!editor.crop) editor.crop = defaultCrop();
  placeCropBox();
}

function placeCropBox() {
  const c = editor.crop;
  const canvas = $('editCanvas');
  const box = $('cropBox');
  box.style.left = canvas.offsetLeft + c.x * canvas.width + 'px';
  box.style.top = canvas.offsetTop + c.y * canvas.height + 'px';
  box.style.width = c.w * canvas.width + 'px';
  box.style.height = c.h * canvas.height + 'px';
  $('faceGuide').classList.toggle('hidden', kindFor(editor.row) !== 'photo');
}

function startDrag(e) {
  const handle = e.target.dataset.handle || 'move';
  e.preventDefault();
  e.target.setPointerCapture?.(e.pointerId);
  editor.drag = { handle, x: e.clientX, y: e.clientY, crop: { ...editor.crop } };
}

function moveDrag(e) {
  const d = editor.drag;
  if (!d) return;
  const canvas = $('editCanvas');
  const dx = (e.clientX - d.x) / canvas.width;
  const dy = (e.clientY - d.y) / canvas.height;
  const s = d.crop;
  const MIN = 0.05;
  let { x, y, w, h } = s;
  if (d.handle === 'move') {
    x = Math.min(Math.max(0, s.x + dx), 1 - s.w);
    y = Math.min(Math.max(0, s.y + dy), 1 - s.h);
  } else {
    const left = d.handle.includes('w');
    const top = d.handle.includes('n');
    // Opposite corner stays fixed.
    const ax = left ? s.x + s.w : s.x;
    const ay = top ? s.y + s.h : s.y;
    w = Math.max(MIN, left ? s.w - dx : s.w + dx);
    h = Math.max(MIN, top ? s.h - dy : s.h + dy);
    const locked = editor.aspect && $('editLock').checked;
    if (locked) {
      const { w: rw, h: rh } = rotatedSize();
      const frac = editor.aspect * (rh / rw); // shape in fraction units
      if (Math.abs(dx) > Math.abs(dy)) h = w / frac;
      else w = h * frac;
    }
    // Keep inside the image.
    const maxW = left ? ax : 1 - ax;
    const maxH = top ? ay : 1 - ay;
    if (w > maxW || h > maxH) {
      const k = Math.min(maxW / w, maxH / h);
      w *= k;
      h *= k;
    }
    x = left ? ax - w : ax;
    y = top ? ay - h : ay;
  }
  editor.crop = { x, y, w, h };
  placeCropBox();
}

function endDrag() {
  editor.drag = null;
}

function applyEditor() {
  const row = editor.row;
  const full = editor.crop && editor.crop.w > 0.995 && editor.crop.h > 0.995;
  row.edits = { rotate: editor.rotate, crop: full ? null : { ...editor.crop } };
  closeEditor();
  schedule(row);
  track('image_kb_edit', { rotated: editor.rotate !== 0, cropped: !full });
}

function closeEditor() {
  $('editDialog').close();
  editor.bitmap?.close?.();
  editor.bitmap = null;
}

// ── Static content from the presets (single source of truth) ──────────────
function buildGroupSelect() {
  const select = $('groupSelect');
  EXAM_GROUPS.forEach((g) => {
    const opt = el('option', '', g.label);
    opt.value = g.id;
    select.appendChild(opt);
  });
  const custom = el('option', '', 'Custom size (enter your own KB range, px or cm)');
  custom.value = CUSTOM_ID;
  select.appendChild(custom);
}

function buildSizeChips() {
  const wrap = $('sizeChips');
  getGroup('size').docs.forEach((d) => {
    const b = el('button', 'kb-chip', d.maxKB + ' KB');
    b.type = 'button';
    b.dataset.size = d.id;
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => {
      setSizeDoc(d.id);
      track('image_kb_size_chip', { size: d.id });
    });
    wrap.appendChild(b);
  });
}

function buildSpecTable() {
  $('lastChecked').textContent = new Date(PRESETS_LAST_CHECKED).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const body = $('specTableBody');
  // On an exam page, that exam comes first.
  const groups = EXAM_GROUPS.filter((g) => g.id !== 'size').sort((a, b) => (b.id === PAGE.group) - (a.id === PAGE.group));
  groups.forEach((g) => {
    g.docs.forEach((d, i) => {
      const tr = el('tr', g.id === PAGE.group ? 'kb-row-current' : '');
      const exam = el('td', 'font-medium');
      if (i === 0) exam.textContent = g.short;
      tr.appendChild(exam);
      const doc = el('td', '', d.label);
      if (d.stamp) doc.appendChild(el('span', 'block text-xs text-gray-500 dark:text-gray-400', 'Name and date on photo'));
      if (d.note) doc.appendChild(el('span', 'block text-xs text-gray-500 dark:text-gray-400', d.note));
      tr.appendChild(doc);
      tr.appendChild(el('td', 'whitespace-nowrap', rangeText(d)));
      tr.appendChild(el('td', 'whitespace-nowrap', dimsText(d) || 'Not fixed'));
      body.appendChild(tr);
    });
  });
}

function updateCustomHint() {
  const unit = $('customUnit').value;
  $('customDpiWrap').classList.toggle('hidden', unit === 'px');
  const spec = customSpec();
  $('customHint').textContent = spec.width
    ? `Output: exactly ${spec.width} × ${spec.height} px${unit === 'px' ? '' : ` (${$('customWidth').value} × ${$('customHeight').value} ${unit} at ${$('customDpi').value || 200} DPI)`}.`
    : 'Leave width and height empty to keep the original shape.';
}

// ── Wiring ────────────────────────────────────────────────────────────────
buildGroupSelect();
buildSizeChips();
buildSpecTable();

const params = new URLSearchParams(location.search);
const initial = params.get('exam') || PAGE.group;
const startGroup = initial && (initial === CUSTOM_ID || getGroup(initial)) ? initial : 'banking';
if (PAGE.doc && getGroup('size').docs.some((d) => d.id === PAGE.doc)) state.sizeDoc = PAGE.doc;
if (PAGE.stamp) state.stamp.on = true;
$('stampToggle').checked = state.stamp.on;
$('stampFields').classList.toggle('hidden', !state.stamp.on);
$('stampDate').value = state.stamp.date;
$('cleanToggle').checked = state.clean;
$('groupSelect').value = startGroup;
setSizeDoc(state.sizeDoc);
setGroup(startGroup);
updateCustomHint();

$('groupSelect').addEventListener('change', function () {
  setGroup(this.value);
  track('image_kb_group_change', { group: this.value });
});

let customTimer = null;
['customMin', 'customMax', 'customWidth', 'customHeight', 'customFit', 'customUnit', 'customDpi'].forEach((id) => {
  $(id).addEventListener('input', () => {
    updateCustomHint();
    clearTimeout(customTimer);
    customTimer = setTimeout(rescheduleAll, 400);
  });
});

$('stampToggle').addEventListener('change', function () {
  state.stamp.on = this.checked;
  $('stampFields').classList.toggle('hidden', !this.checked);
  if (this.checked) $('stampName').focus();
  track('image_kb_stamp', { on: this.checked });
  rescheduleAll();
});
let stampTimer = null;
['stampName', 'stampDate'].forEach((id) => {
  $(id).addEventListener('input', () => {
    state.stamp.name = $('stampName').value;
    state.stamp.date = $('stampDate').value;
    clearTimeout(stampTimer);
    stampTimer = setTimeout(rescheduleAll, 500);
  });
});
$('cleanToggle').addEventListener('change', function () {
  state.clean = this.checked;
  track('image_kb_clean', { on: this.checked });
  rescheduleAll();
});

const dropZone = $('dropZone');
const fileInput = $('fileInput');
dropZone.addEventListener('click', (e) => {
  if (e.target.closest('#cameraBtn')) return;
  fileInput.click();
});
dropZone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    fileInput.click();
  }
});
fileInput.addEventListener('change', function () {
  if (this.files.length) addFiles(this.files);
  this.value = '';
});
// Phones: open the camera directly.
if (window.matchMedia('(pointer: coarse)').matches) $('cameraBtn').classList.remove('hidden');
$('cameraBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  $('cameraInput').click();
});
$('cameraInput').addEventListener('change', function () {
  if (this.files.length) addFiles(this.files);
  this.value = '';
  track('image_kb_camera', {});
});
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
});
// Paste a screenshot or copied image.
document.addEventListener('paste', (e) => {
  const files = Array.from(e.clipboardData?.files || []).filter((f) => f.type.startsWith('image/'));
  const t = e.target instanceof Element ? e.target : null;
  if (files.length && !t?.closest('input, textarea')) addFiles(files);
});
$('downloadAllBtn').addEventListener('click', () => {
  downloadAll().catch((err) => {
    reportError(err, 'resize_to_kb_zip');
    showToast('Could not create the ZIP. Download files one by one.', 'error');
  });
});
$('clearAllBtn').addEventListener('click', clearAll);

// Editor
$('cropBox').addEventListener('pointerdown', startDrag);
window.addEventListener('pointermove', moveDrag);
window.addEventListener('pointerup', endDrag);
$('rotateLeft').addEventListener('click', () => { editor.rotate = (editor.rotate + 270) % 360; editor.crop = null; drawEditor(); });
$('rotateRight').addEventListener('click', () => { editor.rotate = (editor.rotate + 90) % 360; editor.crop = null; drawEditor(); });
$('editReset').addEventListener('click', () => { editor.rotate = 0; editor.crop = null; drawEditor(); });
$('editLock').addEventListener('change', () => { editor.crop = defaultCrop(); placeCropBox(); });
$('editApply').addEventListener('click', applyEditor);
$('editCancel').addEventListener('click', closeEditor);
$('editDialog').addEventListener('cancel', () => { editor.bitmap?.close?.(); editor.bitmap = null; });
window.addEventListener('resize', () => { if ($('editDialog').open) drawEditor(); });
