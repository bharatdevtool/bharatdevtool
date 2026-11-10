// qr-generator-page.js — QR code generator UI. Everything runs in the browser:
// the content (links, Wi-Fi passwords, UPI IDs…) is never sent anywhere.
// Telemetry carries fixed labels only (type, format, style flags) — never the content.

import { buildPayload, isValidVpa } from './qr-payloads.js';
import { renderQrSvg, PRESETS, DEFAULT_STYLE, contrastRatio, brightness } from './qr-render.js';

const $ = (id) => document.getElementById(id);
const STYLE_KEY = 'bdt_qr_style';
const JSQR_SRC = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
const JSQR_SRI = 'sha384-hStSInNIZ8ljtOVrmrgf7zdHMapaLBWoSnPTtF0nzsybp4+LuhDz6sHuEVpWIX8o';

function track(name, params) {
  if (window.Analytics) window.Analytics.track(name, Object.assign({ page: 'QR Code Generator' }, params || {}));
}
function toast(message, type) {
  const t = document.createElement('div');
  t.className = 'toast' + (type === 'error' ? ' error' : '');
  t.textContent = message;
  $('toastContainer').appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, 2600);
}
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};
const icon = (path) => `<svg fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;

// ── Types and their fields ───────────────────────────────────────────────────
const ICONS = {
  url: '<path d="M10 14a4 4 0 005.66 0l3-3a4 4 0 00-5.66-5.66l-1 1"/><path d="M14 10a4 4 0 00-5.66 0l-3 3a4 4 0 005.66 5.66l1-1"/>',
  text: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  wifi: '<path d="M5 12.5a10 10 0 0114 0M8.5 16a5 5 0 017 0M2 9a14.5 14.5 0 0120 0"/><circle cx="12" cy="19.5" r="1"/>',
  upi: '<path d="M7 5h10M7 9h10M7 5c5 0 5 8 0 8l7 6"/>',
  whatsapp: '<path d="M20 11.5a8 8 0 01-11.8 7L4 20l1.5-4.1A8 8 0 1120 11.5z"/>',
  vcard: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M6 16c.6-1.5 1.7-2 3-2s2.4.5 3 2M15 10h3M15 13h3"/>',
  email: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  sms: '<path d="M4 5h16v11H8l-4 4V5z"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/>',
  location: '<path d="M12 21s-7-6.1-7-11a7 7 0 0114 0c0 4.9-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  event: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
};

/** @type {{ id: string, label: string, fields: any[], note?: string }[]} */
const TYPES = [
  { id: 'url', label: 'Link', fields: [{ k: 'url', label: 'Website or link', placeholder: 'https://example.com', type: 'url', inputmode: 'url' }] },
  { id: 'text', label: 'Text', fields: [{ k: 'text', label: 'Your text', textarea: true, placeholder: 'Any message, code or note' }] },
  {
    id: 'wifi', label: 'Wi-Fi',
    note: 'Guests point their camera at the code and join without typing the password.',
    fields: [
      { k: 'ssid', label: 'Network name (SSID)', placeholder: 'e.g. Sharma Home', autocomplete: 'off' },
      { k: 'password', label: 'Password', type: 'password', autocomplete: 'off', showWhen: (v) => v.security !== 'nopass' },
      { k: 'security', label: 'Security', select: [['WPA', 'WPA / WPA2 / WPA3 (most routers)'], ['WEP', 'WEP (old routers)'], ['nopass', 'None (open network)']] },
      { k: 'hidden', label: 'Hidden network', checkbox: true },
    ],
  },
  {
    id: 'upi', label: 'UPI',
    note: 'Works with Google Pay, PhonePe, Paytm, BHIM and every UPI app. Leave the amount empty for a shop QR.',
    fields: [
      { k: 'vpa', label: 'UPI ID', placeholder: 'name@okhdfcbank', autocomplete: 'off', validate: (v) => (v && !isValidVpa(v) ? 'Enter a UPI ID like name@bank.' : '') },
      { k: 'name', label: 'Name shown to the payer', placeholder: 'e.g. Sharma General Store' },
      { k: 'amount', label: 'Amount in ₹ (optional)', placeholder: 'Customer enters it', inputmode: 'decimal', validate: (v) => (v && !(Number(v) > 0) ? 'Enter an amount like 250 or 99.50.' : '') },
      { k: 'note', label: 'Note (optional)', placeholder: 'e.g. Invoice 1024' },
    ],
  },
  {
    id: 'whatsapp', label: 'WhatsApp',
    note: 'Opens a WhatsApp chat with your number, with the message ready to send.',
    fields: [
      { k: 'phone', label: 'WhatsApp number', placeholder: '98765 43210 (India) or +44…', type: 'tel', inputmode: 'tel' },
      { k: 'message', label: 'Message (optional)', textarea: true, placeholder: 'Hi! I saw your QR code…' },
    ],
  },
  {
    id: 'vcard', label: 'Contact card',
    note: 'For visiting cards: scanning offers "Add to contacts" on iPhone and Android, with your details filled in. Fill only what you need: fewer details make a code that is easier to scan when printed small.',
    fields: [
      { k: 'first', label: 'First name', half: true, autocomplete: 'given-name' },
      { k: 'last', label: 'Last name', half: true, autocomplete: 'family-name' },
      { k: 'phone', label: 'Mobile', half: true, type: 'tel', inputmode: 'tel', autocomplete: 'tel' },
      { k: 'email', label: 'Email', half: true, type: 'email', autocomplete: 'email' },
      { k: 'org', label: 'Company', half: true, autocomplete: 'organization' },
      { k: 'title', label: 'Job title', half: true, autocomplete: 'organization-title' },
      { k: 'website', label: 'Website', type: 'url', inputmode: 'url' },
      { k: 'address', label: 'Address', autocomplete: 'street-address' },
    ],
  },
  {
    id: 'email', label: 'Email',
    fields: [
      { k: 'to', label: 'Send to', type: 'email', placeholder: 'hello@example.com' },
      { k: 'subject', label: 'Subject (optional)' },
      { k: 'body', label: 'Message (optional)', textarea: true },
    ],
  },
  {
    id: 'sms', label: 'SMS',
    fields: [
      { k: 'phone', label: 'Phone number', type: 'tel', inputmode: 'tel', placeholder: '98765 43210' },
      { k: 'message', label: 'Message', textarea: true },
    ],
  },
  { id: 'phone', label: 'Call', fields: [{ k: 'phone', label: 'Phone number', type: 'tel', inputmode: 'tel', placeholder: '98765 43210' }] },
  {
    id: 'location', label: 'Location',
    note: 'Opens Google Maps at this place. Paste coordinates like 28.6129, 77.2295 for an exact spot.',
    fields: [{ k: 'place', label: 'Address, place name or coordinates', placeholder: 'India Gate, New Delhi' }],
  },
  {
    id: 'event', label: 'Event',
    note: 'Adds the event to the phone’s calendar.',
    fields: [
      { k: 'title', label: 'Event name', placeholder: 'e.g. Annual Day 2026' },
      { k: 'start', label: 'Starts', type: 'datetime-local', half: true },
      { k: 'end', label: 'Ends (optional)', type: 'datetime-local', half: true },
      { k: 'location', label: 'Where (optional)' },
      { k: 'description', label: 'Details (optional)', textarea: true },
    ],
  },
];

// ── State ────────────────────────────────────────────────────────────────────
const state = {
  type: 'url',
  /** Values per type, kept in memory only (never stored). */
  values: Object.fromEntries(TYPES.map((t) => [t.id, t.id === 'wifi' ? { security: 'WPA' } : {}])),
  style: loadStyle(),
  preset: 'classic',
  ecl: 'auto',
  payload: '',
  svg: '',
  dims: { width: 1, height: 1 },
  checkToken: 0,
};

function loadStyle() {
  try {
    const saved = JSON.parse(localStorage.getItem(STYLE_KEY) || '{}');
    return { ...DEFAULT_STYLE, ...saved, logo: null };
  } catch {
    return { ...DEFAULT_STYLE };
  }
}
function saveStyle() {
  try {
    const { logo, ...rest } = state.style; // the logo stays in memory only
    localStorage.setItem(STYLE_KEY, JSON.stringify(rest));
  } catch {
    /* storage blocked: fine */
  }
}

// ── Fields ───────────────────────────────────────────────────────────────────
function renderTabs() {
  const tabs = $('qrTabs');
  tabs.innerHTML = '';
  TYPES.forEach((t) => {
    const b = el('button', 'qr-tab');
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', String(t.id === state.type));
    b.innerHTML = icon(ICONS[t.id]) + `<span>${t.label}</span>`;
    b.addEventListener('click', () => {
      if (state.type === t.id) return;
      state.type = t.id;
      renderTabs();
      renderFields(true);
      update();
    });
    tabs.appendChild(b);
  });
}

function renderFields(focus) {
  const type = TYPES.find((t) => t.id === state.type);
  const values = state.values[type.id];
  const box = $('qrFields');
  box.innerHTML = '';
  if (type.note) box.appendChild(el('p', 'qr-hint !mt-0', type.note));
  const grid = el('div', 'grid sm:grid-cols-2 gap-4');
  box.appendChild(grid);
  let first = null;
  type.fields.forEach((fd) => {
    const wrap = el('div', fd.half ? '' : 'sm:col-span-2');
    if (fd.showWhen && !fd.showWhen(values)) wrap.classList.add('hidden');
    const id = `f_${type.id}_${fd.k}`;
    if (fd.checkbox) {
      const lab = el('label', 'qr-switch');
      const input = el('input');
      input.type = 'checkbox';
      input.id = id;
      input.checked = Boolean(values[fd.k]);
      input.addEventListener('change', () => {
        values[fd.k] = input.checked;
        update();
      });
      lab.append(input, document.createTextNode(' ' + fd.label));
      wrap.appendChild(lab);
      grid.appendChild(wrap);
      return;
    }
    const label = el('label', 'qr-label', fd.label);
    label.htmlFor = id;
    wrap.appendChild(label);
    let input;
    if (fd.select) {
      input = el('select', 'qr-input');
      fd.select.forEach(([v, t]) => {
        const o = el('option', '', t);
        o.value = v;
        input.appendChild(o);
      });
      input.value = values[fd.k] || fd.select[0][0];
      values[fd.k] = input.value;
    } else if (fd.textarea) {
      input = el('textarea', 'qr-input');
      input.rows = 3;
    } else {
      input = el('input', 'qr-input');
      input.type = fd.type === 'password' ? 'password' : fd.type || 'text';
    }
    input.id = id;
    if (!fd.select) input.value = values[fd.k] || '';
    if (fd.placeholder) input.placeholder = fd.placeholder;
    if (fd.inputmode) input.inputMode = fd.inputmode;
    input.autocomplete = fd.autocomplete || 'off';
    input.spellcheck = false;
    const err = el('p', 'qr-error hidden');
    const onInput = () => {
      values[fd.k] = input.value;
      if (fd.validate) {
        const msg = fd.validate(input.value.trim());
        err.textContent = msg;
        err.classList.toggle('hidden', !msg);
      }
      if (fd.k === 'security') renderFields(false);
      update();
    };
    input.addEventListener(fd.select ? 'change' : 'input', onInput);
    if (fd.type === 'password') {
      const row = el('div', 'relative');
      row.appendChild(input);
      input.classList.add('pr-16');
      const show = el('button', 'absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-blue-600 dark:text-blue-400 px-2 py-1', 'Show');
      show.type = 'button';
      show.addEventListener('click', () => {
        input.type = input.type === 'password' ? 'text' : 'password';
        show.textContent = input.type === 'password' ? 'Show' : 'Hide';
      });
      row.appendChild(show);
      wrap.appendChild(row);
    } else wrap.appendChild(input);
    wrap.appendChild(err);
    grid.appendChild(wrap);
    if (!first && !fd.select) first = input;
  });
  if (focus && first && window.matchMedia('(pointer: fine)').matches) first.focus();
}

// ── Design controls ──────────────────────────────────────────────────────────
const SAMPLE = (() => {
  // A small fixed code for the style thumbnails.
  const q = window.qrcode(2, 'M');
  q.addData('BHARATDEVTOOL');
  q.make();
  return { size: q.getModuleCount(), isDark: (r, c) => q.isDark(r, c) };
})();

function renderPresets() {
  const list = $('presetList');
  list.innerHTML = '';
  Object.entries(PRESETS).forEach(([name, p]) => {
    const b = el('button', 'qr-preset');
    b.type = 'button';
    b.title = name[0].toUpperCase() + name.slice(1);
    b.setAttribute('aria-label', `${b.title} style`);
    b.setAttribute('aria-pressed', String(state.preset === name));
    b.innerHTML = renderQrSvg(SAMPLE, { ...DEFAULT_STYLE, ...p, margin: 1 }).svg;
    b.addEventListener('click', () => {
      state.preset = name;
      Object.assign(state.style, DEFAULT_STYLE, p, { logo: state.style.logo, logoSize: state.style.logoSize, frame: state.style.frame, frameText: state.style.frameText, margin: state.style.margin, transparent: false });
      if (state.style.frame !== 'none') state.style.frameColor = p.eyeColor || p.fg;
      syncDesignControls();
      update();
      track('qr_style_preset', { preset: name });
    });
    list.appendChild(b);
  });
}

const DOT_ICONS = {
  square: '<rect x="3" y="3" width="8" height="8"/><rect x="13" y="3" width="8" height="8"/><rect x="3" y="13" width="8" height="8"/>',
  rounded: '<rect x="3" y="3" width="8" height="8" rx="2.4"/><rect x="13" y="3" width="8" height="8" rx="2.4"/><rect x="3" y="13" width="8" height="8" rx="2.4"/>',
  dots: '<circle cx="7" cy="7" r="4"/><circle cx="17" cy="7" r="4"/><circle cx="7" cy="17" r="4"/>',
  fluid: '<path d="M3 7a4 4 0 014-4h10a4 4 0 014 4v0a4 4 0 01-4 4H11v6a4 4 0 01-8 0z"/>',
};
const EYE_ICONS = {
  square: '<path fill-rule="evenodd" d="M2 2h20v20H2zM6 6v12h12V6z"/>',
  rounded: '<path fill-rule="evenodd" d="M8 2h8a6 6 0 016 6v8a6 6 0 01-6 6H8a6 6 0 01-6-6V8a6 6 0 016-6zm0 4a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2V8a2 2 0 00-2-2z"/>',
  circle: '<path fill-rule="evenodd" d="M12 2a10 10 0 110 20 10 10 0 010-20zm0 4a6 6 0 100 12 6 6 0 000-12z"/>',
};
const BALL_ICONS = { square: '<rect x="6" y="6" width="12" height="12"/>', rounded: '<rect x="6" y="6" width="12" height="12" rx="3.5"/>', circle: '<circle cx="12" cy="12" r="6.5"/>' };

function segmented(containerId, options, key, iconSet) {
  const box = $(containerId);
  box.innerHTML = '';
  options.forEach(([value, label]) => {
    const b = el('button', 'qr-opt');
    b.type = 'button';
    b.dataset.value = value;
    b.title = label;
    b.setAttribute('aria-label', label);
    b.innerHTML = iconSet ? `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${iconSet[value]}</svg>` : label;
    b.addEventListener('click', () => {
      state.style[key] = value;
      state.preset = '';
      syncDesignControls();
      update();
    });
    box.appendChild(b);
  });
}

function colorPair(colorId, hexId, key) {
  const c = $(colorId);
  const h = $(hexId);
  c.addEventListener('input', () => {
    state.style[key] = c.value;
    h.value = c.value;
    state.preset = '';
    update();
  });
  h.addEventListener('input', () => {
    const v = h.value.trim();
    if (/^#?[0-9a-f]{6}$/i.test(v)) {
      state.style[key] = v.startsWith('#') ? v : `#${v}`;
      c.value = state.style[key];
      state.preset = '';
      update();
    }
  });
}

function syncDesignControls() {
  const s = state.style;
  const press = (id, value) => $(id).querySelectorAll('[data-value]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.value === value)));
  press('dotStyles', s.dots);
  press('eyeFrameStyles', s.eyeFrame);
  press('eyeBallStyles', s.eyeBall);
  press('frameStyles', s.frame);
  $('presetList').querySelectorAll('.qr-preset').forEach((b) => b.setAttribute('aria-pressed', String(b.title.toLowerCase() === state.preset)));
  [['fgColor', 'fgHex', s.fg], ['fg2Color', 'fg2Hex', s.fg2], ['bgColor', 'bgHex', s.bg], ['eyeColor', 'eyeHex', s.eyeColor || s.fg], ['frameColor', 'frameHex', s.frameColor]].forEach(([a, b, v]) => {
    $(a).value = v;
    $(b).value = v;
  });
  $('gradientOn').checked = s.gradient !== 'none';
  $('fg2Wrap').classList.toggle('hidden', s.gradient === 'none');
  $('transparentOn').checked = s.transparent;
  $('eyeSame').checked = !s.eyeColor;
  $('eyeWrap').classList.toggle('hidden', !s.eyeColor);
  $('frameControls').classList.toggle('hidden', s.frame === 'none');
  $('frameText').value = s.frameText;
  $('logoControls').classList.toggle('hidden', !s.logo);
  $('logoRemove').classList.toggle('hidden', !s.logo);
  $('logoSize').value = String(Math.round(s.logoSize * 100));
  $('logoBg').checked = s.logoBg;
  $('marginRange').value = String(s.margin);
  $('marginValue').textContent = String(s.margin);
  $('qrStage').classList.toggle('checker', s.transparent);
}

// Quick icons for the centre (generic, drawn here: no brand logos).
const QUICK_LOGOS = ['url', 'wifi', 'upi', 'phone', 'email', 'location', 'whatsapp'].map((k) => [
  k,
  'data:image/svg+xml;charset=utf-8,' +
    encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#0f172a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[k]}</svg>`),
]);

function renderQuickLogos() {
  const box = $('quickLogos');
  box.innerHTML = '';
  QUICK_LOGOS.forEach(([k, url]) => {
    const b = el('button', 'qr-quicklogo');
    b.type = 'button';
    b.dataset.logo = url;
    b.setAttribute('aria-label', `${k} icon in the centre`);
    b.setAttribute('aria-pressed', String(state.style.logo === url));
    const img = el('img');
    img.src = url;
    img.alt = '';
    b.appendChild(img);
    b.addEventListener('click', () => setLogo(url, 'icon'));
    box.appendChild(b);
  });
}

function setLogo(url, source) {
  state.style.logo = url;
  if (url && state.style.frame === 'none' && !state.style.logoBg) state.style.logoBg = true;
  syncDesignControls();
  $('quickLogos').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.logo === url)));
  update();
  if (url) track('qr_logo', { source });
}

// ── Rendering ────────────────────────────────────────────────────────────────
let encoderReady = false;
function encode(text, ecl) {
  if (!encoderReady) {
    // UTF-8 so Hindi and emoji encode correctly.
    window.qrcode.stringToBytes = window.qrcode.stringToBytesFuncs['UTF-8'];
    encoderReady = true;
  }
  const q = window.qrcode(0, ecl);
  q.addData(text, 'Byte');
  q.make();
  return { size: q.getModuleCount(), isDark: (r, c) => q.isDark(r, c) };
}

let updateTimer = null;
function update() {
  clearTimeout(updateTimer);
  updateTimer = setTimeout(render, 60);
}

function render() {
  const payload = buildPayload(state.type, state.values[state.type]);
  state.payload = payload;
  const empty = !payload.trim();
  const ecl = state.ecl !== 'auto' ? state.ecl : state.style.logo ? 'H' : 'M';
  let m;
  try {
    m = encode(empty ? 'https://bharatdevtool.com' : payload, ecl);
  } catch {
    setStatus('bad', 'Too much content for one QR code. Shorten the text, or use a link to a page instead.');
    setDownloads(false);
    return;
  }
  state.modules = m.size;
  const { svg, width, height } = renderQrSvg(m, state.style);
  state.svg = svg;
  state.dims = { width, height };
  $('qrPreview').innerHTML = svg;
  $('mobileThumb').innerHTML = svg;
  $('mobileBar').classList.toggle('hidden', empty);
  $('qrPreview').classList.toggle('empty', empty);
  $('qrEmptyMsg').classList.toggle('hidden', !empty);
  $('payloadView').textContent = empty ? '' : maskSecrets(payload);
  setDownloads(!empty);
  saveStyle();
  if (empty) {
    setStatus('wait', 'Waiting for details…');
    return;
  }
  const issue = designIssue();
  setStatus(issue ? 'warn' : 'wait', issue || 'Checking that phones can scan it…');
  scheduleScanCheck(payload, issue);
}

function maskSecrets(p) {
  return state.type === 'wifi' ? p.replace(/(;P:)((?:\\.|[^;])*)/, (_, a, pw) => a + '•'.repeat(Math.min(12, pw.length))) : p;
}

/** Design choices that often stop phones scanning. */
/**
 * Smallest safe print width, for scanning from about 20–30 cm: each module needs roughly 0.4 mm,
 * plus the quiet zone. A frame adds to the printed size but not to the code.
 */
function minPrintCm() {
  const mm = (state.modules + 2 * Math.max(2, state.style.margin)) * 0.4;
  return Math.max(1.5, Math.ceil(mm) / 10);
}

/** Dense codes (many contact details, long text) need more printed space. */
function densityNote() {
  if (state.modules < 57) return '';
  const what = state.type === 'vcard' ? 'Lots of contact details make a dense code' : 'This is a dense code';
  return `${what}: print it at least ${minPrintCm().toFixed(1)} cm wide${state.type === 'vcard' ? ', or leave out optional details for a small visiting card' : ''}.`;
}

function designIssue() {
  const s = state.style;
  const bg = s.transparent ? '#ffffff' : s.bg;
  const fgs = [s.fg, ...(s.gradient !== 'none' ? [s.fg2] : []), ...(s.eyeColor ? [s.eyeColor] : [])];
  const worst = Math.min(...fgs.map((c) => contrastRatio(c, bg)));
  if (worst < 3) return 'Low contrast between the code and the background: many phones won’t read it. Use a darker code colour or a lighter background.';
  if (Math.min(...fgs.map(brightness)) > brightness(bg)) return 'Light code on a dark background: some older phones and scanners can’t read inverted codes.';
  if (s.transparent) return 'Transparent background: put it on a plain light surface, or scanners may not find it.';
  if (s.margin < 2) return 'Very small white border: leave space around the code when you print it.';
  return densityNote();
}

function setStatus(kind, text) {
  const s = $('qrStatus');
  s.className = `qr-status ${kind} mt-4`;
  const mark = kind === 'ok' ? '<path d="M5 13l4 4L19 7"/>' : kind === 'wait' ? '<circle cx="12" cy="12" r="8"/>' : '<path d="M12 8v5M12 16.5v.5"/><circle cx="12" cy="12" r="9"/>';
  s.innerHTML = `<svg class="w-4 h-4 mt-px shrink-0" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" viewBox="0 0 24 24" aria-hidden="true">${mark}</svg><span></span>`;
  s.querySelector('span').textContent = text;
  const short = { ok: 'Scans correctly', warn: 'Check the warning', bad: 'Won\u2019t scan reliably', wait: kind === 'wait' && state.payload ? 'Checking…' : 'Fill in the details' }[kind];
  $('mobileStatus').innerHTML = `<span class="font-semibold">${kind === 'ok' ? '✓ ' : kind === 'bad' ? '! ' : ''}${short}</span><br>PNG · SVG below`;
}

function setDownloads(on) {
  ['downloadPng', 'downloadSvg', 'copyImage', 'shareImage'].forEach((id) => ($(id).disabled = !on));
}

// ── Scan check: decode our own image like a phone would ─────────────────────
let jsqrPromise = null;
function loadJsQR() {
  if (window.jsQR) return Promise.resolve(window.jsQR);
  if (!jsqrPromise) {
    jsqrPromise = new Promise((resolve, reject) => {
      const sc = document.createElement('script');
      sc.src = JSQR_SRC;
      sc.integrity = JSQR_SRI;
      sc.crossOrigin = 'anonymous';
      sc.onload = () => resolve(window.jsQR);
      sc.onerror = () => {
        jsqrPromise = null;
        reject(new Error('jsQR failed to load'));
      };
      document.head.appendChild(sc);
    });
  }
  return jsqrPromise;
}

let checkTimer = null;
function scheduleScanCheck(payload, issue) {
  clearTimeout(checkTimer);
  const token = ++state.checkToken;
  checkTimer = setTimeout(async () => {
    try {
      const [jsQR, canvas] = await Promise.all([loadJsQR(), rasterize(480)]);
      if (token !== state.checkToken) return;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const res = jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' });
      if (token !== state.checkToken) return;
      if (res && res.data === payload) {
        setStatus(issue ? 'warn' : 'ok', issue ? `Scans in our test, but: ${issue}` : `Scans correctly. Print it at least ${minPrintCm().toFixed(1)} cm wide.`);
      } else {
        setStatus('bad', 'This design doesn’t scan reliably. Try a smaller logo, more contrast, the Classic style or higher error correction.');
        track('qr_scan_check_failed', { dots: state.style.dots, logo: Boolean(state.style.logo), gradient: state.style.gradient !== 'none' });
      }
    } catch {
      if (token === state.checkToken) setStatus(issue ? 'warn' : 'ok', issue || 'Ready. (The automatic scan test is unavailable offline.)');
    }
  }, 350);
}

/** Draw the current SVG onto a canvas `px` wide (white behind it unless transparent). */
function rasterize(px, keepTransparent = false) {
  return new Promise((resolve, reject) => {
    const { width, height } = state.dims;
    const w = Math.round(px);
    const h = Math.round((px * height) / width);
    const blob = new Blob([state.svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');
      if (!keepTransparent) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
      }
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(c);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('SVG render failed'));
    };
    img.src = url;
  });
}

// ── Export ───────────────────────────────────────────────────────────────────
const fileBase = () => `qr-code-${state.type}`;
function saveBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const flags = () => ({ type: state.type, dots: state.style.dots, logo: Boolean(state.style.logo), frame: state.style.frame, gradient: state.style.gradient !== 'none' });

async function pngBlob(px) {
  const c = await rasterize(px, state.style.transparent);
  return new Promise((r) => c.toBlob(r, 'image/png'));
}

$('downloadPng').addEventListener('click', async () => {
  const px = Number($('pngSize').value);
  saveBlob(await pngBlob(px), `${fileBase()}.png`);
  track('download_qr_code', { format: 'png', size: px, ...flags() });
  if (window.BDTShare) window.BDTShare.successPrompt($('qrStatus'), 'QR code ready! Know someone who needs one? Share this free tool.');
});
$('mobileDownload').addEventListener('click', () => $('downloadPng').click());
$('mobileThumb').addEventListener('click', () => $('previewCard').scrollIntoView({ behavior: 'smooth' }));
$('downloadSvg').addEventListener('click', () => {
  const px = 1024;
  const svg = state.svg.replace('<svg ', `<svg width="${px}" height="${Math.round((px * state.dims.height) / state.dims.width)}" `);
  saveBlob(new Blob([svg], { type: 'image/svg+xml' }), `${fileBase()}.svg`);
  track('download_qr_code', { format: 'svg', ...flags() });
});
$('copyImage').addEventListener('click', async () => {
  try {
    const blob = await pngBlob(1024);
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    toast('Copied. Paste it into WhatsApp, Docs or an email.');
    track('copy_qr_url', { format: 'image', type: state.type });
  } catch {
    toast('This browser can’t copy images. Use Download instead.', 'error');
  }
});
if (navigator.canShare && navigator.canShare({ files: [new File([''], 'x.png', { type: 'image/png' })] }) && window.matchMedia('(pointer: coarse)').matches) {
  $('shareImage').classList.remove('hidden');
  $('shareImage').addEventListener('click', async () => {
    try {
      const file = new File([await pngBlob(1024)], `${fileBase()}.png`, { type: 'image/png' });
      await navigator.share({ files: [file] });
      track('download_qr_code', { format: 'share', ...flags() });
    } catch {
      /* cancelled */
    }
  });
}

// ── Wiring ───────────────────────────────────────────────────────────────────
segmented('dotStyles', [['square', 'Square'], ['rounded', 'Rounded'], ['dots', 'Dots'], ['fluid', 'Fluid']], 'dots', DOT_ICONS);
segmented('eyeFrameStyles', [['square', 'Square'], ['rounded', 'Rounded'], ['circle', 'Circle']], 'eyeFrame', EYE_ICONS);
segmented('eyeBallStyles', [['square', 'Square'], ['rounded', 'Rounded'], ['circle', 'Circle']], 'eyeBall', BALL_ICONS);
segmented('frameStyles', [['none', 'No frame'], ['card', 'Card'], ['pill', 'Label']], 'frame');
colorPair('fgColor', 'fgHex', 'fg');
colorPair('fg2Color', 'fg2Hex', 'fg2');
colorPair('bgColor', 'bgHex', 'bg');
colorPair('eyeColor', 'eyeHex', 'eyeColor');
colorPair('frameColor', 'frameHex', 'frameColor');

$('gradientOn').addEventListener('change', (e) => {
  state.style.gradient = e.target.checked ? 'linear' : 'none';
  state.preset = '';
  syncDesignControls();
  update();
});
$('transparentOn').addEventListener('change', (e) => {
  state.style.transparent = e.target.checked;
  syncDesignControls();
  update();
});
$('eyeSame').addEventListener('change', (e) => {
  state.style.eyeColor = e.target.checked ? '' : state.style.fg;
  syncDesignControls();
  update();
});
$('frameText').addEventListener('input', (e) => {
  state.style.frameText = e.target.value;
  update();
});
['SCAN ME', 'SCAN TO PAY', 'JOIN WI-FI', 'SAVE CONTACT', 'MENU', 'CHAT WITH US'].forEach((t) => {
  const b = el('button', 'text-xs px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-400', t);
  b.type = 'button';
  b.addEventListener('click', () => {
    state.style.frameText = t;
    $('frameText').value = t;
    update();
  });
  $('frameIdeas').appendChild(b);
});
$('logoUploadBtn').addEventListener('click', () => $('logoInput').click());
$('logoInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  if (file.size > 3 * 1024 * 1024) {
    toast('Please choose a logo under 3 MB.', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => setLogo(String(reader.result), 'upload');
  reader.readAsDataURL(file);
});
$('logoRemove').addEventListener('click', () => setLogo(null));
$('logoSize').addEventListener('input', (e) => {
  state.style.logoSize = Number(e.target.value) / 100;
  update();
});
$('logoBg').addEventListener('change', (e) => {
  state.style.logoBg = e.target.checked;
  update();
});
$('eclSelect').addEventListener('change', (e) => {
  state.ecl = e.target.value;
  update();
});
$('marginRange').addEventListener('input', (e) => {
  state.style.margin = Number(e.target.value);
  $('marginValue').textContent = e.target.value;
  update();
});

// Landing-page preset (e.g. visiting-card-qr-code.html starts on Contact card).
try {
  const page = JSON.parse(document.getElementById('qrPage')?.textContent || '{}');
  if (page.type && TYPES.some((t) => t.id === page.type)) state.type = page.type;
  if (page.frameText) state.style.frameText = page.frameText;
} catch {
  /* no preset */
}

// Prefill from another tool (e.g. the DeepLink tester): #text=…
const prefill = window.__bdtPrefill && window.__bdtPrefill.get('text');
if (prefill) {
  const isLink = /^(https?:\/\/|[\w-]+\.[a-z]{2,})/i.test(prefill.trim());
  state.type = isLink ? 'url' : 'text';
  state.values[state.type][isLink ? 'url' : 'text'] = prefill;
}

// The old generator kept a history of every code's content; it is no longer used.
try {
  localStorage.removeItem('qr-history');
} catch {
  /* ignore */
}

renderTabs();
renderFields(!prefill);
renderPresets();
renderQuickLogos();
syncDesignControls();
render();

let typed = false;
document.addEventListener('input', () => {
  if (typed || !state.payload) return;
  typed = true;
  track('generate_qr_code', { type: state.type });
});
