// draft.js — remember the last text a tool was given, so a refresh or an
// accidentally closed tab doesn't lose it.
//
// Stored only in this browser (localStorage), never sent anywhere. A draft is
// only restored into an EMPTY field, so share links, "Send to" hand-offs and
// samples always win. Clearing a field forgets it; drafts expire after TTL.
//
// Compression: drafts are saved deflate-compressed (the browser's built-in
// CompressionStream, lossless, typically 5-15x smaller for JSON), so the exact
// text comes back, formatting included, even half-edited or invalid JSON.
// Compressing is asynchronous, so when the tab is closing with unsaved changes
// the text is written uncompressed instead (that must be instant); the next
// normal save compresses it again.
//
// Size: localStorage holds about 5 MB per site, shared with everything else the
// site keeps there (hand-offs between tools, Regex Tester state, preferences).
// One field may take up to MAX_STORED in storage (MAX_TEXT before compression),
// and all drafts together stay under TOTAL_BUDGET; the oldest drafts of other
// pages are dropped first to make room. Anything larger is not remembered.
//
// Opt in per field:
//   <textarea id="x" data-draft>                       plain text field
//   <textarea id="x" data-draft data-draft-mode="a b"> also restores which of
//        the mode buttons #a / #b was pressed (aria-pressed="true") first
// Or from code (e.g. a CodeMirror editor):
//   const d = BDTDraft.attach({ id, get, set });  d.changed() on edit;  d.restore()
//
// Do not use on tools that handle secrets (JWT, hashes, cURL headers, Base64).
(function () {
  var PREFIX = 'bdt_draft:';
  var MAX_TEXT = 5000000; // longest text we try to keep, before compression (characters)
  var MAX_STORED = 1000000; // most one field may take in storage (~1 MB)
  var TOTAL_BUDGET = 2000000; // all drafts together, leaving room for the rest of the site
  var TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
  var SAVE_DELAY = 600;

  function storage() {
    try { return window.localStorage; } catch (e) { return null; }
  }

  function pageKey(id) {
    var path = location.pathname.replace(/index\.html$/, '').replace(/\.html$/, '');
    return PREFIX + path + '#' + id;
  }

  // ── Compression (deflate-raw + base64) ───────────────────────────────

  function canCompress() {
    return typeof CompressionStream === 'function' && typeof DecompressionStream === 'function' &&
      typeof Response === 'function' && typeof Blob === 'function';
  }

  function toBase64(bytes) {
    var bin = '';
    for (var i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }

  function fromBase64(b64) {
    var bin = atob(b64);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function pipe(bytes, stream) {
    return new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer().then(function (buf) {
      return new Uint8Array(buf);
    });
  }

  function compress(text) {
    return pipe(new TextEncoder().encode(text), new CompressionStream('deflate-raw')).then(toBase64);
  }

  function decompress(b64) {
    return pipe(fromBase64(b64), new DecompressionStream('deflate-raw')).then(function (bytes) {
      return new TextDecoder().decode(bytes);
    });
  }

  // ── Records: { v: text } or { z: compressed }, plus t (saved at) and m (mode) ──

  function remove(key) {
    try { var s = storage(); if (s) s.removeItem(key); } catch (e) { /* ignore */ }
  }

  function readRecord(key) {
    var s = storage();
    if (!s) return null;
    try {
      var d = JSON.parse(s.getItem(key) || 'null');
      var ok = d && (typeof d.v === 'string' || typeof d.z === 'string') && typeof d.t === 'number' && Date.now() - d.t <= TTL;
      if (!ok) { s.removeItem(key); return null; }
      return d;
    } catch (e) {
      remove(key);
      return null;
    }
  }

  /** The text of a record (decompressed if needed). */
  function recordText(d) {
    if (typeof d.v === 'string') return Promise.resolve(d.v);
    if (!canCompress()) return Promise.reject(new Error('cannot decompress'));
    return decompress(d.z);
  }

  /** Write one record, keeping all drafts within TOTAL_BUDGET (oldest other drafts go first). */
  function put(key, value) {
    var s = storage();
    if (!s) return;
    try {
      if (value.length > MAX_STORED) { s.removeItem(key); return; }
      var others = [];
      var total = value.length;
      for (var i = 0; i < s.length; i++) {
        var k = s.key(i);
        if (!k || k.indexOf(PREFIX) !== 0 || k === key) continue;
        var size = (s.getItem(k) || '').length;
        others.push({ key: k, size: size });
        total += size;
      }
      if (total > TOTAL_BUDGET) {
        others.forEach(function (d) {
          try { d.t = JSON.parse(s.getItem(d.key)).t || 0; } catch (e) { d.t = 0; }
        });
        others.sort(function (a, b) { return a.t - b.t; });
        while (total > TOTAL_BUDGET && others.length) {
          var oldest = others.shift();
          s.removeItem(oldest.key);
          total -= oldest.size;
        }
      }
      try {
        s.setItem(key, value);
      } catch (full) {
        // Storage full anyway (other data): free all other drafts and try once more.
        others.forEach(function (d) { s.removeItem(d.key); });
        try { s.setItem(key, value); } catch (e) { s.removeItem(key); }
      }
    } catch (e) { /* storage blocked: just don't remember */ }
  }

  function isEmpty(text) {
    return !text || !text.trim();
  }

  /** Synchronous, uncompressed: for a closing tab, where there is no time to compress. */
  function writePlain(key, text, mode) {
    if (isEmpty(text) || text.length > MAX_STORED) { remove(key); return; }
    put(key, JSON.stringify({ v: text, t: Date.now(), m: mode || undefined }));
  }

  /**
   * Compressed when the browser supports it (falls back to plain).
   * `isCurrent()` says whether this save is still the newest one when compression finishes.
   */
  function writeCompressed(key, text, mode, isCurrent) {
    isCurrent = isCurrent || function () { return true; };
    if (isEmpty(text) || text.length > MAX_TEXT) { remove(key); return Promise.resolve(); }
    var plain = JSON.stringify({ v: text, t: Date.now(), m: mode || undefined });
    if (!canCompress() || text.length < 2000) { // short text: compression doesn't pay off
      put(key, plain);
      return Promise.resolve();
    }
    return compress(text).then(function (z) {
      if (!isCurrent()) return;
      var packed = JSON.stringify({ z: z, t: Date.now(), m: mode || undefined });
      put(key, packed.length < plain.length ? packed : plain);
    }, function () {
      if (isCurrent()) writePlain(key, text, mode);
    });
  }

  /** Drop expired drafts from every page (cheap: only our own keys). */
  function purgeExpired() {
    var s = storage();
    if (!s) return;
    try {
      var keys = [];
      for (var i = 0; i < s.length; i++) {
        var k = s.key(i);
        if (k && k.indexOf(PREFIX) === 0) keys.push(k);
      }
      keys.forEach(readRecord);
    } catch (e) { /* ignore */ }
  }

  // JSON sent from another tool ("Send to" → handoff.js) is waiting: that is a
  // fresh start, so don't fill the page's other fields with an old draft.
  // Checked now, before handoff.js reads and removes it on DOMContentLoaded.
  var handoffPending = (function () {
    try { return !!(storage() && storage().getItem('bdt_handoff')); } catch (e) { return false; }
  })();

  var restoredFields = [];
  var noticeShown = false;

  function attach(opts) {
    var key = pageKey(opts.id);
    var timer = null;
    var seq = 0; // bumps on every write, so a slow compressed save never overwrites a newer one
    var written = null; // text currently in storage (null: unknown)
    var restoring = false;

    function mode() {
      return opts.getMode ? opts.getMode() : undefined;
    }

    /** Normal save, after typing pauses: compressed. */
    function save() {
      clearTimeout(timer);
      timer = null;
      if (restoring) return;
      var text = opts.get();
      if (text === written) return;
      var mine = ++seq;
      writeCompressed(key, text, mode(), function () { return mine === seq; }).then(function () {
        if (mine === seq) written = text;
      });
    }

    /** Tab hidden or closing: write now, uncompressed, if anything changed. */
    function flush() {
      clearTimeout(timer);
      timer = null;
      if (restoring) return; // the draft hasn't been put back yet: keep it
      var text = opts.get();
      if (text === written) return;
      ++seq;
      writePlain(key, text, mode());
      written = text;
    }

    // Also catches changes made by buttons (Clear, Swap, Sample) that don't fire input events.
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') flush();
    });

    var field = {
      changed: function () {
        clearTimeout(timer);
        timer = setTimeout(save, SAVE_DELAY);
      },
      save: save,
      /** Put the draft back if the field is empty. Resolves to true if it did. */
      restore: function () {
        if (handoffPending || opts.get()) return Promise.resolve(false);
        var d = readRecord(key);
        if (!d) return Promise.resolve(false);
        restoring = true;
        return recordText(d).then(function (text) {
          restoring = false;
          if (opts.get()) return false; // the user started typing meanwhile
          if (d.m && opts.setMode) opts.setMode(d.m);
          // Already compressed: no need to save it again. Plain (from a closing tab): recompress.
          written = d.z ? text : null;
          opts.set(text);
          restoredFields.push(field);
          showNotice();
          return true;
        }, function () {
          restoring = false;
          remove(key);
          return false;
        });
      },
      forget: function () {
        clearTimeout(timer);
        ++seq;
        remove(key);
        written = '';
      },
      clear: function () {
        field.forget();
        opts.set('');
      },
    };
    return field;
  }

  // ── "Restored" notice ─────────────────────────────────────────────

  var CSS =
    '.bdt-draft-note{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:10000;' +
    'display:flex;align-items:center;gap:12px;max-width:calc(100vw - 32px);padding:10px 14px;border-radius:10px;' +
    'font:14px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;background:#0f172a;color:#e2e8f0;' +
    'border:1px solid #1e293b;box-shadow:0 8px 24px rgba(0,0,0,.25)}' +
    '.bdt-draft-note button{flex:none;border:0;border-radius:6px;padding:4px 10px;font:inherit;font-weight:600;cursor:pointer;' +
    'background:#1e293b;color:#93c5fd}' +
    '.bdt-draft-note button:hover{background:#334155}' +
    '[data-theme="light"] .bdt-draft-note{background:#fff;color:#0f172a;border-color:#e2e8f0}' +
    '[data-theme="light"] .bdt-draft-note button{background:#eff6ff;color:#2563eb}';

  function showNotice() {
    if (noticeShown) return;
    noticeShown = true;
    setTimeout(function () {
      if (!document.getElementById('bdt-draft-style')) {
        var style = document.createElement('style');
        style.id = 'bdt-draft-style';
        style.textContent = CSS;
        document.head.appendChild(style);
      }
      var note = document.createElement('div');
      note.className = 'bdt-draft-note';
      note.setAttribute('role', 'status');
      var text = document.createElement('span');
      text.textContent = 'Restored your last input (kept only in this browser).';
      var clear = document.createElement('button');
      clear.type = 'button';
      clear.textContent = 'Clear';
      clear.addEventListener('click', function () {
        restoredFields.forEach(function (f) { f.clear(); });
        note.remove();
        track('cleared');
      });
      note.appendChild(text);
      note.appendChild(clear);
      document.body.appendChild(note);
      setTimeout(function () { note.remove(); }, 7000);
      track('restored');
    }, 0);
  }

  function track(action) {
    // Fixed labels only: never the text itself.
    try { if (window.Analytics && window.Analytics.track) window.Analytics.track('draft_' + action, {}); } catch (e) { /* optional */ }
  }

  // ── Plain fields: <textarea data-draft> ─────────────────────────────

  function isPressed(el) {
    return !!el && (el.getAttribute('aria-pressed') === 'true' || el.classList.contains('active'));
  }

  function attachElement(el) {
    var modeIds = (el.getAttribute('data-draft-mode') || '').split(/\s+/).filter(Boolean);
    var field = attach({
      id: el.id,
      get: function () { return el.value; },
      set: function (v) {
        el.value = v;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      },
      getMode: modeIds.length ? function () {
        for (var i = 0; i < modeIds.length; i++) if (isPressed(document.getElementById(modeIds[i]))) return modeIds[i];
        return undefined;
      } : null,
      setMode: modeIds.length ? function (id) {
        var btn = modeIds.indexOf(id) !== -1 && document.getElementById(id);
        if (btn && !isPressed(btn)) btn.click();
      } : null,
    });
    el.addEventListener('input', field.changed);
    return field;
  }

  function init() {
    purgeExpired();
    var els = document.querySelectorAll('textarea[data-draft][id], input[data-draft][id]');
    var fields = Array.prototype.map.call(els, attachElement);
    fields.forEach(function (f) { f.restore(); });
  }

  window.BDTDraft = {
    attach: attach,
    _test: {
      pageKey: pageKey, readRecord: readRecord, recordText: recordText, writePlain: writePlain,
      writeCompressed: writeCompressed, MAX_TEXT: MAX_TEXT, MAX_STORED: MAX_STORED, TOTAL_BUDGET: TOTAL_BUDGET,
    },
  };

  // After the page's own DOMContentLoaded set-up, so its listeners see the restored text.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 0); });
  } else {
    setTimeout(init, 0);
  }
})();
