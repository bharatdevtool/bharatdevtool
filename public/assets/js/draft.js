// draft.js — remember the last text a tool was given, so a refresh or an
// accidentally closed tab doesn't lose it.
//
// Stored only in this browser (localStorage), never sent anywhere. Limits keep
// it small and short-lived: at most MAX_LINES lines and MAX_CHARS characters
// per field, removed after TTL. Clearing a field forgets it. A draft is only
// restored into an EMPTY field, so share links, "Send to" hand-offs and
// samples always win.
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
  var MAX_LINES = 300;
  var MAX_CHARS = 100000;
  var TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
  var SAVE_DELAY = 400;

  function storage() {
    try { return window.localStorage; } catch (e) { return null; }
  }

  function pageKey(id) {
    var path = location.pathname.replace(/index\.html$/, '').replace(/\.html$/, '');
    return PREFIX + path + '#' + id;
  }

  /** Small enough to keep: within the line and character limits. */
  function fits(text) {
    if (text.length > MAX_CHARS) return false;
    var lines = 1;
    for (var i = text.indexOf('\n'); i !== -1; i = text.indexOf('\n', i + 1)) {
      if (++lines > MAX_LINES) return false;
    }
    return true;
  }

  function read(key) {
    var s = storage();
    if (!s) return null;
    try {
      var d = JSON.parse(s.getItem(key) || 'null');
      if (!d || typeof d.v !== 'string' || typeof d.t !== 'number' || Date.now() - d.t > TTL) {
        s.removeItem(key);
        return null;
      }
      return d;
    } catch (e) {
      try { s.removeItem(key); } catch (e2) { /* ignore */ }
      return null;
    }
  }

  function write(key, text, mode) {
    var s = storage();
    if (!s) return;
    try {
      if (!text || !text.trim() || !fits(text)) s.removeItem(key);
      else s.setItem(key, JSON.stringify({ v: text, t: Date.now(), m: mode || undefined }));
    } catch (e) { /* storage full or blocked: just don't remember */ }
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
      keys.forEach(read);
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

    function save() {
      clearTimeout(timer);
      timer = null;
      write(key, opts.get(), opts.getMode && opts.getMode());
    }

    // Also save when the tab is hidden or closed, which catches changes made by
    // buttons (Clear, Swap, Sample) that don't fire an input event.
    window.addEventListener('pagehide', save);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') save();
    });

    var field = {
      changed: function () {
        clearTimeout(timer);
        timer = setTimeout(save, SAVE_DELAY);
      },
      save: save,
      /** Put the draft back if the field is empty. Returns true if it did. */
      restore: function () {
        if (handoffPending || opts.get()) return false;
        var d = read(key);
        if (!d) return false;
        if (d.m && opts.setMode) opts.setMode(d.m);
        opts.set(d.v);
        restoredFields.push(field);
        showNotice();
        return true;
      },
      forget: function () {
        clearTimeout(timer);
        var s = storage();
        try { if (s) s.removeItem(key); } catch (e) { /* ignore */ }
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

  window.BDTDraft = { attach: attach, _test: { fits: fits, pageKey: pageKey, read: read, write: write, MAX_LINES: MAX_LINES } };

  // After the page's own DOMContentLoaded set-up, so its listeners see the restored text.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 0); });
  } else {
    setTimeout(init, 0);
  }
})();
