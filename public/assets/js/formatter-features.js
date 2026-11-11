// formatter-features.js — JSON Formatter extras: error location, link popover,
// indent/sort preferences, JSONPath query bar, "Send to" other tools, share links, toasts.
// Everything runs in the browser. Analytics get fixed labels and counts only.

import {
  findJSONError,
  lineColumnAt,
  parseLoose,
  parseNDJSON,
  sortKeysDeep,
  stringifyIndented,
  queryJSONPath,
  encodeShare,
  decodeShare,
} from './json-tools.js';
import { lineRangeForPath, pathToString } from './json-grid-model.js';
import { repairJSON } from './formatter.js';
import { parseJSONPrecise, hasRoundedIntegers, PRECISE_NUMBERS } from './json-raw.js';

const track = (feature, action, params) => {
  try { window.Analytics?.trackFormatterFeature?.(feature, action, params); } catch { /* analytics optional */ }
};

// ── Toast ──────────────────────────────────────────────────

let toastTimer = null;
/** Short status message in the corner. Text only. */
export function toast(message, { duration = 3200 } = {}) {
  let box = document.getElementById('bdt-toast');
  if (!box) {
    box = document.createElement('div');
    box.id = 'bdt-toast';
    box.className = 'bdt-toast';
    box.setAttribute('role', 'status');
    box.setAttribute('aria-live', 'polite');
    document.body.appendChild(box);
  }
  box.textContent = message;
  box.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => box.classList.remove('show'), duration);
}

// ── Preferences: indent and sort keys ──────────────────────

const PREFS_KEY = 'json_formatter_prefs';
const prefs = { indent: '2', sortKeys: false };

export function getPrefs() {
  return prefs;
}

/** Wire the indent select and sort checkbox; `onChange` re-formats the output. */
export function initPrefs(onChange) {
  try {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
    if (['2', '4', 'tab'].includes(saved.indent)) prefs.indent = saved.indent;
    prefs.sortKeys = saved.sortKeys === true;
  } catch { /* storage blocked or bad value */ }
  const indentSel = /** @type {HTMLSelectElement|null} */ (document.getElementById('indent-select'));
  const sortCb = /** @type {HTMLInputElement|null} */ (document.getElementById('sort-keys'));
  if (indentSel) indentSel.value = prefs.indent;
  if (sortCb) sortCb.checked = prefs.sortKeys;
  const save = () => {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* ignore */ }
  };
  indentSel?.addEventListener('change', () => {
    prefs.indent = indentSel.value;
    save();
    track('format_options', 'indent', { indent: prefs.indent });
    onChange();
  });
  sortCb?.addEventListener('change', () => {
    prefs.sortKeys = sortCb.checked;
    save();
    track('format_options', sortCb.checked ? 'sort_on' : 'sort_off');
    onChange();
  });
}

/** JSON text for a value using the current preferences. */
export function stringifyWithPrefs(value, { sort = prefs.sortKeys } = {}) {
  return stringifyIndented(sort ? sortKeysDeep(value) : value, prefs.indent);
}

// ── Reading input: strict JSON, NDJSON, JSON5 / JS objects, repair ──

/**
 * Turn the input text into a value.
 * @returns {{ ok: true, value: unknown, note?: string } | { ok: false, error: { line: number, column: number, offset: number|null, message: string } }}
 */
export function readInput(src) {
  const text = src.replace(/^\uFEFF/, '');
  const result = readInputValue(text);
  // Browsers without JSON.rawJSON round integers past 2^53: say so instead of changing data silently.
  if (result.ok && !PRECISE_NUMBERS && hasRoundedIntegers(result.value)) {
    const warn = 'Some numbers have more than 15 digits and were rounded by this browser. Use a recent Chrome, Edge, Firefox or Safari to keep them exact.';
    result.note = result.note ? `${result.note} ${warn}` : warn;
  }
  return result;
}

function readInputValue(text) {
  try {
    return { ok: true, value: parseJSONPrecise(text) };
  } catch { /* not strict JSON */ }

  const nd = parseNDJSON(text);
  if (nd && 'values' in nd) {
    return { ok: true, value: nd.values, note: `Read ${nd.values.length} lines as NDJSON (one JSON value per line) and put them in an array.` };
  }

  try {
    return { ok: true, value: parseLoose(text), note: 'Converted JSON5 / JavaScript object syntax to JSON.' };
  } catch { /* not JSON5 either */ }

  try {
    return { ok: true, value: parseJSONPrecise(repairJSON(text)), note: 'Repaired the JSON (quotes, commas, comments).' };
  } catch { /* cannot be repaired */ }

  if (nd && 'line' in nd) {
    return { ok: false, error: { line: nd.line, column: nd.column, offset: null, message: `${nd.message} (reading the text as NDJSON, one JSON value per line)` } };
  }
  const e = findJSONError(text);
  if (e) return { ok: false, error: e };
  return { ok: false, error: { line: 1, column: 1, offset: 0, message: 'This is not valid JSON' } };
}

// ── Error location in the input editor ─────────────────────

let errorMarks = [];
let errorLineHandle = null;

function clearErrorMarks(editor) {
  errorMarks.forEach((m) => m.clear());
  errorMarks = [];
  if (errorLineHandle) {
    editor.removeLineClass(errorLineHandle, 'background', 'cm-error-line');
    errorLineHandle = null;
  }
}

/** Put the cursor on the error and scroll to it. */
export function goToError(editor, error) {
  const line = Math.max(0, error.line - 1);
  const ch = Math.max(0, error.column - 1);
  editor.focus();
  editor.setCursor({ line, ch });
  editor.scrollIntoView({ line, ch }, 120);
}

/**
 * Show an error under the input with "Go to error", underline the spot and tint the line.
 * `fixable` adds a hint that Format can repair it.
 */
export function showInputError(editor, errorBox, error, { fixable = false, prefix = '' } = {}) {
  clearErrorMarks(editor);
  errorBox.textContent = '';
  errorBox.classList.remove('info');
  const lineIdx = Math.max(0, Math.min(editor.lineCount() - 1, error.line - 1));
  const lineText = editor.getLine(lineIdx) || '';
  const ch = Math.max(0, Math.min(lineText.length, error.column - 1));
  const to = { line: lineIdx, ch: Math.min(lineText.length, ch + 1) };
  if (to.ch === ch && ch > 0) errorMarks.push(editor.markText({ line: lineIdx, ch: ch - 1 }, { line: lineIdx, ch }, { className: 'cm-json-error' }));
  else errorMarks.push(editor.markText({ line: lineIdx, ch }, to, { className: 'cm-json-error' }));
  errorLineHandle = editor.addLineClass(lineIdx, 'background', 'cm-error-line');

  const msg = document.createElement('span');
  msg.textContent = `${prefix}Line ${error.line}, column ${error.column}: ${error.message}${fixable ? ' Press Format to fix it automatically.' : ''}`;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'error-goto';
  btn.textContent = 'Go to error';
  btn.addEventListener('click', () => {
    goToError(editor, error);
    track('error', 'go_to_error');
  });
  errorBox.append(msg, ' ', btn);
}

/** Informational note under the input (not an error). */
export function showInputNote(editor, errorBox, note) {
  clearErrorMarks(editor);
  errorBox.textContent = note || '';
  errorBox.classList.toggle('info', !!note);
}

export function clearInputError(editor, errorBox) {
  clearErrorMarks(editor);
  errorBox.textContent = '';
  errorBox.classList.remove('info');
}

const LIVE_CHECK_MAX = 2 * 1024 * 1024;
let liveTimer = null;
/** While typing: if the input is invalid, show where (debounced). */
export function scheduleLiveErrorCheck(editor, errorBox) {
  clearTimeout(liveTimer);
  liveTimer = setTimeout(() => {
    const text = editor.getValue();
    if (!text.trim() || text.length > LIVE_CHECK_MAX) { clearErrorMarks(editor); return; }
    const err = findJSONError(text);
    if (!err) {
      if (!errorBox.classList.contains('info')) clearInputError(editor, errorBox);
      return;
    }
    const nd = parseNDJSON(text);
    if (nd && 'values' in nd) { clearErrorMarks(editor); errorBox.textContent = ''; return; }
    let fixable = false;
    try { parseLoose(text); fixable = true; } catch {
      try { repairJSON(text); fixable = true; } catch { /* not fixable */ }
    }
    showInputError(editor, errorBox, err, { fixable });
  }, 300);
}

// ── Links: open with Cmd/Ctrl+click, hover popover with Open / Copy ──

function urlFromString(raw) {
  const clean = raw.replace(/^["']|["']$/g, '').trim();
  if (!/^https?:\/\//i.test(clean)) return null;
  try {
    const u = new URL(clean);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
  } catch { return null; }
}

/** The URL string under the mouse in a CodeMirror editor, if any. */
function urlAt(cm, event) {
  const pos = cm.coordsChar({ left: event.clientX, top: event.clientY }, 'window');
  const token = cm.getTokenAt(pos, true);
  if (!token || !token.type || !/string/.test(token.type)) return null;
  return urlFromString(token.string);
}

const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
/** How long the link popover stays after the mouse leaves the link, so there is time to reach Copy. */
const POP_LINGER_MS = 2500;

export function initLinkPopover(editors) {
  const pop = document.createElement('div');
  pop.className = 'link-pop';
  pop.setAttribute('role', 'dialog');
  pop.setAttribute('aria-label', 'Link');
  pop.hidden = true;
  const openBtn = document.createElement('button');
  openBtn.type = 'button';
  openBtn.textContent = 'Open ↗';
  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.textContent = 'Copy link';
  const hint = document.createElement('span');
  hint.className = 'link-pop-hint';
  hint.textContent = `or ${isMac ? '⌘' : 'Ctrl'}+click`;
  pop.append(openBtn, copyBtn, hint);
  document.body.appendChild(pop);

  let current = null;
  let currentAnchor = null; // the link element the popover belongs to
  let hideTimer = null;
  let showTimer = null;

  const hide = () => {
    pop.hidden = true;
    current = null;
    currentAnchor = null;
  };
  const show = (url, x, y) => {
    current = url;
    pop.hidden = false;
    const w = pop.offsetWidth;
    pop.style.left = `${Math.max(8, Math.min(x - w / 2, window.innerWidth - w - 8))}px`;
    pop.style.top = `${Math.max(8, y - pop.offsetHeight - 4)}px`;
  };
  openBtn.addEventListener('click', () => {
    if (current) window.open(current, '_blank', 'noopener,noreferrer');
    track('link', 'open_popover');
    hide();
  });
  copyBtn.addEventListener('click', () => {
    if (!current) return;
    navigator.clipboard?.writeText(current).then(() => toast('Link copied'), () => toast('Could not copy'));
    track('link', 'copy');
    hide();
  });
  pop.addEventListener('mouseenter', () => clearTimeout(hideTimer));
  pop.addEventListener('mouseleave', () => { hideTimer = setTimeout(hide, POP_LINGER_MS); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hide();
    if (e.key === 'Meta' || e.key === 'Control') document.body.classList.add('link-mod');
  });
  document.addEventListener('keyup', (e) => {
    if (e.key === 'Meta' || e.key === 'Control') document.body.classList.remove('link-mod');
  });
  window.addEventListener('blur', () => document.body.classList.remove('link-mod'));
  // Keep the popover attached to its link while the editor or page scrolls.
  const follow = () => {
    if (pop.hidden || !currentAnchor) return;
    if (!currentAnchor.isConnected) { hide(); return; }
    const r = currentAnchor.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) { hide(); return; }
    pop.style.top = `${Math.max(8, r.top - pop.offsetHeight - 4)}px`;
  };
  window.addEventListener('scroll', follow, true);

  for (const cm of editors) {
    const wrapper = cm.getWrapperElement();
    // Cmd/Ctrl+click opens; a plain click just places the cursor (so links can be selected and copied).
    cm.on('mousedown', (_cm, event) => {
      if (!(event.metaKey || event.ctrlKey) || event.button !== 0) return;
      const url = urlAt(cm, event);
      if (!url) return;
      event.preventDefault();
      window.open(url, '_blank', 'noopener,noreferrer');
      track('link', 'open_modclick');
    });
    // Plain click on a link (also touch): show the popover instead of opening.
    wrapper.addEventListener('click', (event) => {
      if (event.metaKey || event.ctrlKey) return;
      if (!cm.somethingSelected()) {
        const url = urlAt(cm, event);
        if (url) show(url, event.clientX, event.clientY);
      }
    });
    wrapper.addEventListener('mousemove', (event) => {
      const target = /** @type {HTMLElement} */ (event.target);
      if (!target.closest || !target.closest('.cm-url')) {
        clearTimeout(showTimer);
        if (!pop.hidden) { clearTimeout(hideTimer); hideTimer = setTimeout(hide, POP_LINGER_MS); }
        return;
      }
      clearTimeout(hideTimer);
      const anchor = target.closest('.cm-url');
      if (anchor === currentAnchor && !pop.hidden) return;
      const url = urlAt(cm, event);
      if (!url) return;
      const { clientX } = event;
      clearTimeout(showTimer);
      showTimer = setTimeout(() => {
        if (!anchor.isConnected) return;
        show(url, clientX, anchor.getBoundingClientRect().top);
        currentAnchor = anchor;
      }, 350);
    });
    wrapper.addEventListener('mouseleave', () => {
      clearTimeout(showTimer);
      hideTimer = setTimeout(hide, POP_LINGER_MS);
    });
    cm.on('change', hide);
  }
}

// ── JSONPath query bar ─────────────────────────────────────

const QUERY_RENDER_MAX = 200;
const QUERY_COOKIE = 'bdt_query_bar';

/**
 * @param {{ getOutputText: () => string, reveal: (path: (string|number)[]) => void }} deps
 * @returns {{ refresh: () => void }}
 */
export function initQueryBar({ getOutputText, reveal }) {
  const input = /** @type {HTMLInputElement|null} */ (document.getElementById('query-input'));
  const count = document.getElementById('query-count');
  const results = document.getElementById('query-results');
  const copyBtn = document.getElementById('query-copy');
  const clearBtn = document.getElementById('query-clear');
  const bar = document.getElementById('query-bar');
  const toggle = document.getElementById('query-toggle');
  if (!input || !count || !results) return { refresh() {} };

  // The bar is opened from the toolbar. A cookie remembers that it was open
  // (only the flag, never the query); closing it with × deletes the cookie.
  const setOpen = (open, { remember = true, focus = false } = {}) => {
    if (bar) bar.hidden = !open;
    toggle?.setAttribute('aria-pressed', String(open));
    if (remember) {
      try {
        document.cookie = open
          ? `${QUERY_COOKIE}=1; path=/; max-age=31536000; SameSite=Lax`
          : `${QUERY_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
      } catch { /* cookies blocked */ }
    }
    if (!open) {
      input.value = '';
      run();
    } else if (focus) {
      input.focus();
    }
  };

  let cacheText = null;
  let cacheValue;
  let lastResults = [];
  let timer = null;
  let trackedThisSession = false;

  const parsedOutput = () => {
    const text = getOutputText();
    if (text !== cacheText) {
      cacheText = text;
      try { cacheValue = { ok: true, value: parseJSONPrecise(text) }; } catch { cacheValue = { ok: false }; }
    }
    return cacheValue;
  };

  const preview = (v) => {
    const s = v === undefined ? '' : JSON.stringify(v);
    return s.length > 160 ? s.slice(0, 157) + '…' : s;
  };

  function run() {
    const expr = input.value.trim();
    results.textContent = '';
    lastResults = [];
    input.classList.remove('is-invalid');
    copyBtn?.toggleAttribute('disabled', true);
    if (!expr) {
      results.hidden = true;
      count.textContent = '';
      return;
    }
    results.hidden = false;
    const doc = parsedOutput();
    if (!doc.ok) {
      count.textContent = '';
      results.appendChild(Object.assign(document.createElement('p'), { className: 'query-msg', textContent: 'Format valid JSON first, then query it.' }));
      return;
    }
    try {
      lastResults = queryJSONPath(doc.value, expr);
    } catch (e) {
      input.classList.add('is-invalid');
      count.textContent = '';
      results.appendChild(Object.assign(document.createElement('p'), { className: 'query-msg', textContent: e instanceof Error ? e.message : 'Invalid path' }));
      return;
    }
    const total = /** @type {any} */ (lastResults).truncated;
    count.textContent = total
      ? `first ${lastResults.length} of ${total} matches`
      : `${lastResults.length} match${lastResults.length === 1 ? '' : 'es'}`;
    copyBtn?.toggleAttribute('disabled', lastResults.length === 0);
    if (!trackedThisSession) { track('query', 'run', { matches: lastResults.length }); trackedThisSession = true; }
    if (!lastResults.length) {
      results.appendChild(Object.assign(document.createElement('p'), { className: 'query-msg', textContent: 'No matches.' }));
      return;
    }
    const list = document.createElement('ul');
    list.className = 'query-list';
    for (const r of lastResults.slice(0, QUERY_RENDER_MAX)) {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.title = 'Show in the output';
      const p = document.createElement('code');
      p.className = 'query-path';
      p.textContent = pathToString(r.path);
      const v = document.createElement('span');
      v.className = 'query-value';
      v.textContent = preview(r.value);
      b.append(p, v);
      b.addEventListener('click', () => reveal(r.path));
      li.appendChild(b);
      list.appendChild(li);
    }
    results.appendChild(list);
    if (lastResults.length > QUERY_RENDER_MAX) {
      results.appendChild(Object.assign(document.createElement('p'), {
        className: 'query-msg',
        textContent: `Showing the first ${QUERY_RENDER_MAX}. Copy results to get all ${lastResults.length}.`,
      }));
    }
  }

  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(run, 200);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { clearTimeout(timer); run(); }
    if (e.key === 'Escape') { input.value = ''; run(); }
  });
  clearBtn?.addEventListener('click', () => setOpen(false));
  // Set up last: setOpen() calls run(), which uses the state declared above.
  setOpen(document.cookie.split('; ').includes(`${QUERY_COOKIE}=1`), { remember: false });
  toggle?.addEventListener('click', () => {
    const open = bar ? bar.hidden : true;
    setOpen(open, { focus: open });
    if (open) track('query', 'open_bar');
  });

  copyBtn?.addEventListener('click', () => {
    const text = stringifyIndented(lastResults.map((r) => r.value), getPrefs().indent);
    navigator.clipboard?.writeText(text).then(() => toast(`Copied ${lastResults.length} results`), () => toast('Could not copy'));
    track('query', 'copy_results', { matches: lastResults.length });
  });
  return { refresh: () => { if (input.value.trim()) run(); } };
}

// ── Send to other tools ────────────────────────────────────

const HANDOFF_KEY = 'bdt_handoff';
const TARGETS = {
  typescript: { url: '/json-to-typescript.html', label: 'JSON to TypeScript' },
  yaml: { url: '/yaml-json-converter.html', label: 'YAML converter' },
  csv: { url: '/csv-json-converter.html', label: 'CSV converter' },
  diff: { url: '/jsondiff/', label: 'JSON Diff' },
};

/**
 * Leave `text` for another tool's page (handoff.js there reads it once; it expires in
 * 10 minutes). Returns false if it could not be stored (e.g. too large).
 */
export function handOff(to, text) {
  try {
    localStorage.setItem(HANDOFF_KEY, JSON.stringify({ to, text, t: Date.now() }));
    return true;
  } catch {
    return false;
  }
}

/** Store the JSON for the target page (read once, expires in 10 minutes) and open it in a new tab. */
export function initSendTo({ getOutputText }) {
  const menu = document.getElementById('send-menu');
  const toggle = document.getElementById('send-btn');
  if (!menu || !toggle) return;
  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(menu.classList.contains('open')));
  });
  document.addEventListener('click', (e) => {
    if (!menu.contains(/** @type {Node} */ (e.target))) {
      menu.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });
  for (const item of menu.querySelectorAll('[data-send]')) {
    item.addEventListener('click', () => {
      menu.classList.remove('open');
      const to = item.getAttribute('data-send');
      const target = TARGETS[to];
      const text = getOutputText();
      let valid = true;
      try { JSON.parse(text); } catch { valid = false; }
      if (!text.trim() || !valid) {
        toast('Format valid JSON first, then send it.');
        return;
      }
      if (!handOff(to, text)) {
        toast('This JSON is too large to send. Copy it and paste it into the other tool.');
        return;
      }
      track('send_to', to);
      window.open(target.url, '_blank', 'noopener');
    });
  }
}

// ── Share links ────────────────────────────────────────────

const SHARE_MAX_URL = 120_000;
const SHARE_WARN_URL = 8_000;

export function initShare({ getOutputText, loadShared }) {
  const btn = document.getElementById('share-btn');
  btn?.addEventListener('click', async () => {
    const text = getOutputText();
    let value;
    try { value = parseJSONPrecise(text); } catch {
      toast('Format valid JSON first, then share it.');
      return;
    }
    try {
      const token = await encodeShare(JSON.stringify(value));
      const url = `${location.origin}${location.pathname}#json=${token}`;
      if (url.length > SHARE_MAX_URL) {
        toast('This JSON is too large for a link. Download the file and send that instead.', { duration: 5000 });
        track('share', 'too_large');
        return;
      }
      await navigator.clipboard.writeText(url);
      toast(
        (url.length > SHARE_WARN_URL ? 'Long link copied: some chat apps may cut it. ' : 'Link copied. ') +
          'The JSON is stored inside the link itself (after #), so it never reaches our server. Anyone with the link can read it.',
        { duration: 6500 },
      );
      track('share', 'copy_link', { kb: Math.round(url.length / 1024) });
    } catch {
      toast('Could not create the link in this browser.');
    }
  });

  // Opened from a share link: the inline <head> script moved the token out of the URL.
  const token = window.__bdtShared;
  if (token) {
    delete window.__bdtShared;
    decodeShare(token).then(
      (text) => { loadShared(text); track('share', 'opened'); },
      () => toast('This share link is damaged or incomplete.', { duration: 5000 }),
    );
  }
}

// ── Reveal a path in the code view ─────────────────────────

let linkedLines = [];
/** Highlight and scroll to the lines of `path` in the output editor (exact for formatter output). */
export function revealPathInCode(editor, path) {
  linkedLines.forEach((h) => editor.removeLineClass(h, 'background', 'grid-linked-line'));
  linkedLines = [];
  const text = editor.getValue();
  let value;
  try { value = parseJSONPrecise(text); } catch { return false; }
  // Line numbers are only exact when the text is laid out the way the formatter writes it.
  const same = [prefs.indent, '2', '4', 'tab'].some((ind) => stringifyIndented(value, ind) === text);
  if (!same) return false;
  const range = lineRangeForPath(value, path);
  if (!range) return false;
  for (let line = range.from; line <= range.to; line++) {
    linkedLines.push(editor.addLineClass(line, 'background', 'grid-linked-line'));
  }
  editor.scrollIntoView({ line: range.from, ch: 0 }, 80);
  editor.setCursor({ line: range.from, ch: 0 });
  return true;
}

export { lineColumnAt };
