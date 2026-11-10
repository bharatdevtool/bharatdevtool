// qr-decoder-page.js — QR code scanner UI. Images are read in the browser and never uploaded
// or stored. Links are never opened automatically; risky ones get plain-language warnings.
// Telemetry carries fixed labels only (source, type, warning level) — never the content.

import { parsePayload } from './qr-payloads.js';
import { checkLink, mainDomain } from './qr-link-check.js';

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};
const svg = (path, cls = '') => `<svg class="${cls}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;
const ICON = {
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 012-2h10"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  warn: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9L2 18a2 2 0 001.7 3h16.6a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/>',
  ok: '<path d="M5 13l4 4L19 7"/>',
  link: '<path d="M10 14a4 4 0 005.66 0l3-3a4 4 0 00-5.66-5.66l-1 1"/><path d="M14 10a4 4 0 00-5.66 0l-3 3a4 4 0 005.66 5.66l1-1"/>',
};

function track(name, params) {
  if (window.Analytics) window.Analytics.track(name, Object.assign({ page: 'QR Code Scanner' }, params || {}));
}
function toast(message, type) {
  const t = el('div', 'toast' + (type === 'error' ? ' error' : ''), message);
  $('toastContainer').appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, 2400);
}
async function copy(text, what) {
  try {
    await navigator.clipboard.writeText(text);
    toast(`${what} copied`);
    track('qr_decode_copy', {});
  } catch {
    toast('Could not copy. Select the text and copy it instead.', 'error');
  }
}
function setStatus(kind, text) {
  const s = $('scanStatus');
  s.classList.toggle('hidden', !text);
  if (!text) return;
  s.className = `qr-status ${kind} mt-4`;
  s.innerHTML = svg(kind === 'bad' ? ICON.warn : kind === 'ok' ? ICON.ok : ICON.info, 'w-4 h-4 mt-px shrink-0') + '<span></span>';
  s.querySelector('span').textContent = text;
}

// ── Reading ──────────────────────────────────────────────────────────────────
/** Native detector (Chrome/Edge/Android, Safari 17+): fast, and finds several codes at once. */
let detector = null;
async function getDetector() {
  if (detector !== null) return detector;
  try {
    if ('BarcodeDetector' in window && (await window.BarcodeDetector.getSupportedFormats()).includes('qr_code')) {
      detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      return detector;
    }
  } catch {
    /* fall back to jsQR */
  }
  detector = false;
  return detector;
}

function waitForJsQR() {
  return new Promise((resolve, reject) => {
    if (window.jsQR) return resolve(window.jsQR);
    let tries = 0;
    const t = setInterval(() => {
      if (window.jsQR) {
        clearInterval(t);
        resolve(window.jsQR);
      } else if (++tries > 100) {
        clearInterval(t);
        reject(new Error('jsQR unavailable'));
      }
    }, 50);
  });
}

/** jsQR on a canvas copy of the image, at a few sizes (big photos and tiny screenshots both work). */
async function jsqrDecode(source, w, h) {
  const jsQR = await waitForJsQR();
  for (const max of [1200, 800, 2000]) {
    const scale = Math.min(1, max / Math.max(w, h)) || 1;
    const cw = Math.max(1, Math.round(w * scale));
    const ch = Math.max(1, Math.round(h * scale));
    const c = document.createElement('canvas');
    c.width = cw;
    c.height = ch;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(source, 0, 0, cw, ch);
    const img = ctx.getImageData(0, 0, cw, ch);
    const res = jsQR(img.data, cw, ch, { inversionAttempts: 'attemptBoth' });
    if (res && res.data) return [res.data];
  }
  return [];
}

async function decodeImage(source, w, h) {
  const d = await getDetector();
  if (d) {
    try {
      const found = await d.detect(source);
      const texts = [...new Set(found.map((b) => b.rawValue).filter(Boolean))];
      if (texts.length) return texts;
    } catch {
      /* try jsQR */
    }
  }
  return jsqrDecode(source, w, h);
}

async function readFile(file, source) {
  if (!file || !file.type.startsWith('image/')) {
    toast('Please choose an image (PNG, JPG, WebP or a screenshot).', 'error');
    return;
  }
  stopCamera();
  setStatus('wait', 'Reading the image…');
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    setStatus('bad', 'This image can’t be opened. Try a PNG or JPG screenshot.');
    return;
  }
  try {
    const texts = await decodeImage(bitmap, bitmap.width, bitmap.height);
    if (!texts.length) {
      setStatus('bad', 'No QR code found. Crop closer to the code, make sure it is sharp and fully visible, and try again.');
      track('qr_decode_failed', { source });
      return;
    }
    setStatus('', '');
    showResults(texts);
    track('qr_decode_success', { source, count: texts.length, types: texts.map((t) => parsePayload(t).type).join(',') });
  } catch {
    setStatus('bad', 'Something went wrong while reading the image. Try again.');
  } finally {
    bitmap.close?.();
  }
}

// ── Results ──────────────────────────────────────────────────────────────────
const TYPE_LABEL = { url: 'Website link', wifi: 'Wi-Fi', upi: 'UPI payment', vcard: 'Contact', event: 'Event', email: 'Email', sms: 'SMS', phone: 'Phone', location: 'Location', whatsapp: 'WhatsApp', text: 'Text' };

function showResults(texts) {
  const box = $('results');
  box.innerHTML = '';
  if (texts.length > 1) box.appendChild(el('p', 'text-sm font-medium text-slate-600 dark:text-slate-300', `Found ${texts.length} QR codes in this image.`));
  texts.forEach((t) => box.appendChild(resultCard(t)));
  box.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function warning(level, text) {
  const w = el('div', `qr-warn ${level}`);
  w.innerHTML = svg(level === 'info' ? ICON.info : ICON.warn);
  w.appendChild(el('span', '', text));
  return w;
}

function fieldRow(f) {
  const row = el('div', 'qr-field');
  row.appendChild(el('dt', '', f.label));
  const dd = el('dd', '', f.secret ? '•'.repeat(Math.min(14, f.value.length)) : f.value);
  row.appendChild(dd);
  const actions = el('div', 'flex');
  if (f.secret) {
    const show = el('button', 'qr-icon-btn');
    show.type = 'button';
    show.setAttribute('aria-label', `Show ${f.label.toLowerCase()}`);
    show.innerHTML = svg(ICON.eye);
    show.addEventListener('click', () => {
      const hidden = dd.textContent.startsWith('•');
      dd.textContent = hidden ? f.value : '•'.repeat(Math.min(14, f.value.length));
    });
    actions.appendChild(show);
  }
  if (f.value) {
    const c = el('button', 'qr-icon-btn');
    c.type = 'button';
    c.setAttribute('aria-label', `Copy ${f.label.toLowerCase()}`);
    c.innerHTML = svg(ICON.copy);
    c.addEventListener('click', () => copy(f.value, f.label));
    actions.appendChild(c);
  }
  row.appendChild(actions);
  return row;
}

function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function resultCard(text) {
  const p = parsePayload(text);
  const card = el('article', 'qr-card p-4 sm:p-5');
  const head = el('div', 'flex items-center justify-between gap-3 mb-3');
  const badge = el('span', 'qr-type');
  badge.innerHTML = svg(p.type === 'url' ? ICON.link : ICON.info);
  badge.appendChild(document.createTextNode(TYPE_LABEL[p.type] || p.title));
  head.appendChild(badge);
  const copyAll = el('button', 'qr-btn qr-btn-ghost !py-1.5 !px-3 !text-xs', 'Copy raw text');
  copyAll.type = 'button';
  copyAll.addEventListener('click', () => copy(text, 'Text'));
  head.appendChild(copyAll);
  card.appendChild(head);

  const actions = el('div', 'mt-4 flex flex-wrap gap-2');

  if (p.type === 'url' || p.type === 'whatsapp') {
    const check = checkLink(p.url);
    const site = el('div', 'mb-3');
    site.appendChild(el('p', 'text-xs text-slate-500 dark:text-slate-400 mb-0.5', 'This code opens'));
    site.appendChild(el('p', 'qr-host', check.host ? mainDomain(check.host) : 'An unreadable address'));
    site.appendChild(el('p', 'qr-url mt-1', p.url));
    card.appendChild(site);
    const list = el('div', 'space-y-2');
    check.warnings.forEach((w) => list.appendChild(warning(w.level === 'danger' ? 'danger' : 'warn', w.text)));
    if (!check.warnings.length && check.valid) {
      const ok = el('div', 'qr-warn info');
      ok.innerHTML = svg(ICON.ok);
      ok.appendChild(el('span', '', 'No common scam signs found. Still check that the website name above is the one you expect.'));
      list.appendChild(ok);
    }
    card.appendChild(list);
    p.fields.forEach((f) => card.appendChild(fieldRow(f)));
    if (check.valid) {
      const danger = check.warnings.some((w) => w.level === 'danger');
      const open = el('button', `qr-btn ${danger ? 'qr-btn-danger' : 'qr-btn-primary'}`, danger ? 'Open anyway' : p.type === 'whatsapp' ? 'Open WhatsApp chat' : 'Open link');
      open.type = 'button';
      open.addEventListener('click', () => {
        if (danger && !open.dataset.confirmed) {
          open.dataset.confirmed = '1';
          open.textContent = 'Tap again to open this risky link';
          return;
        }
        window.open(p.url, '_blank', 'noopener,noreferrer');
        track('qr_decode_launch', { type: p.type, level: danger ? 'danger' : check.warnings.length ? 'warn' : 'ok' });
      });
      actions.appendChild(open);
    }
    const c = el('button', 'qr-btn qr-btn-ghost', 'Copy link');
    c.type = 'button';
    c.addEventListener('click', () => copy(p.url, 'Link'));
    actions.appendChild(c);
    track('qr_link_check', { level: check.warnings.some((w) => w.level === 'danger') ? 'danger' : check.warnings.length ? 'warn' : 'ok' });
  } else {
    if (p.type === 'upi') card.appendChild(warning('info', 'A UPI QR code is only for paying. Nobody needs you to scan a code or enter your PIN to receive money: that is always a scam. Check the name before you pay.'));
    if (p.type === 'wifi') card.appendChild(warning('info', 'On a phone, point the camera app at the code to join. On a laptop, copy the password below.'));
    const dl = el('dl', 'mt-2');
    p.fields.forEach((f) => dl.appendChild(fieldRow(f)));
    card.appendChild(dl);
    if (p.type === 'vcard' && p.vcard) {
      const save = el('button', 'qr-btn qr-btn-primary', 'Save contact');
      save.type = 'button';
      save.addEventListener('click', () => download('contact.vcf', p.vcard, 'text/vcard'));
      actions.appendChild(save);
    }
    if (p.type === 'event') {
      const save = el('button', 'qr-btn qr-btn-primary', 'Add to calendar');
      save.type = 'button';
      const ics = /begin:vcalendar/i.test(text) ? text : `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Bharat Dev Tools//QR//EN\n${text.trim()}\nEND:VCALENDAR`;
      save.addEventListener('click', () => download('event.ics', ics, 'text/calendar'));
      actions.appendChild(save);
    }
    if ((p.type === 'email' || p.type === 'phone' || p.type === 'location') && p.url) {
      const open = el('a', 'qr-btn qr-btn-primary', p.type === 'email' ? 'Write email' : p.type === 'phone' ? 'Call' : 'Open in Maps');
      open.href = p.url;
      if (p.type === 'location') {
        open.target = '_blank';
        open.rel = 'noopener noreferrer';
      }
      actions.appendChild(open);
    }
  }
  if (actions.childElementCount) card.appendChild(actions);
  return card;
}

// ── Camera ───────────────────────────────────────────────────────────────────
let stream = null;
let scanning = false;

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    toast('This browser can’t use the camera. Upload a photo instead.', 'error');
    return;
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false });
  } catch {
    setStatus('bad', 'Camera access was blocked. Allow the camera in your browser settings, or upload a photo instead.');
    track('camera_error', {});
    return;
  }
  const video = $('video');
  video.srcObject = stream;
  await video.play().catch(() => {});
  $('dropZone').classList.add('hidden');
  $('cameraPanel').classList.remove('hidden');
  setStatus('', '');
  scanning = true;
  track('camera_start', {});
  loop();
}

function stopCamera() {
  scanning = false;
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  $('cameraPanel').classList.add('hidden');
  $('dropZone').classList.remove('hidden');
}

async function loop() {
  const video = $('video');
  while (scanning) {
    if (video.readyState >= 2 && video.videoWidth) {
      try {
        const texts = await decodeImage(video, video.videoWidth, video.videoHeight);
        if (texts.length && scanning) {
          navigator.vibrate?.(60);
          stopCamera();
          showResults(texts);
          track('qr_decode_success', { source: 'camera', count: texts.length, types: texts.map((t) => parsePayload(t).type).join(',') });
          return;
        }
      } catch {
        /* keep scanning */
      }
    }
    await new Promise((r) => setTimeout(r, 180));
  }
}

// ── Wiring ───────────────────────────────────────────────────────────────────
const drop = $('dropZone');
drop.addEventListener('click', (e) => {
  if (e.target.closest('#cameraBtn')) return;
  $('fileInput').click();
});
drop.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    $('fileInput').click();
  }
});
$('cameraBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  startCamera();
});
$('stopCamera').addEventListener('click', stopCamera);
$('fileInput').addEventListener('change', (e) => {
  readFile(e.target.files[0], 'upload');
  e.target.value = '';
});
drop.addEventListener('dragover', (e) => {
  e.preventDefault();
  drop.classList.add('drag');
});
drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
drop.addEventListener('drop', (e) => {
  e.preventDefault();
  drop.classList.remove('drag');
  readFile(e.dataTransfer.files[0], 'drop');
});
document.addEventListener('paste', (e) => {
  const file = Array.from(e.clipboardData?.files || []).find((f) => f.type.startsWith('image/'));
  if (file) {
    e.preventDefault();
    readFile(file, 'paste');
  }
});
window.addEventListener('pagehide', stopCamera);

// The old scanner kept every scanned image and its contents in this browser; remove them.
try {
  localStorage.removeItem('qr-decoder-history');
} catch {
  /* ignore */
}
