// handoff.js — receive JSON sent from the JSON Formatter's "Send to" menu.
// Configured by data attributes on its own <script> tag:
//   data-tool    id the formatter uses for this page (typescript | yaml | csv | diff)
//   data-input   id of the textarea to fill
//   data-before  optional id of a button to click first (e.g. pick the JSON → YAML direction)
//   data-run     optional id of the button that converts
//   data-input-right  optional id of a second textarea, filled from the payload's "right" (JSON Diff)
//   data-run-both     optional id of a button to click when both sides were filled (e.g. Compare)
// The data lives in localStorage for at most 10 minutes and is removed as soon as it is read.
(function () {
  var script = document.currentScript;
  if (!script) return;
  var cfg = script.dataset;
  var KEY = 'bdt_handoff';
  var MAX_AGE = 10 * 60 * 1000;

  var right = null;

  function take() {
    var raw = null;
    try {
      raw = localStorage.getItem(KEY);
    } catch {
      return null;
    }
    if (!raw) return null;
    var data;
    try {
      data = JSON.parse(raw);
    } catch {
      data = null;
    }
    if (!data || data.to !== cfg.tool) return null;
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
    if (typeof data.text !== 'string' || Date.now() - data.t > MAX_AGE) return null;
    right = typeof data.right === 'string' ? data.right : null;
    return data.text;
  }

  function click(id) {
    var el = id && document.getElementById(id);
    if (el) el.click();
  }

  function apply() {
    var text = take();
    if (text === null) return;
    click(cfg.before);
    var input = document.getElementById(cfg.input);
    if (!input) return;
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    click(cfg.run);
    var second = right !== null && cfg.inputRight && document.getElementById(cfg.inputRight);
    if (second) {
      second.value = right;
      second.dispatchEvent(new Event('input', { bubbles: true }));
      second.dispatchEvent(new Event('change', { bubbles: true }));
      click(cfg.runBoth);
      return;
    }
    if (cfg.focus) {
      var next = document.getElementById(cfg.focus);
      if (next) next.focus();
    }
  }

  // Run after the page's own DOMContentLoaded set-up.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(apply, 0); });
  } else {
    setTimeout(apply, 0);
  }
})();
