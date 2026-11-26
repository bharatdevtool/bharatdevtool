// public/components/tool-search.js — The ⌘K / Ctrl+K tool search for the static HTML
// pages: loaded by components/header.js, and directly by the JSON Formatter (own header).
// The same search as the Next.js command palette (src/components/ui/CommandPalette.tsx).
// Tools come from /tools-index.json, generated from src/config/tools.ts at build time.
// Matching rule (keep in sync with src/lib/search/toolSearch.ts, checked by
// tests/tool-search.test.ts): every query word must appear in the tool's `text`;
// label-prefix matches first, then label matches, then the rest.
//
// Any element with [data-bdt-search] opens the palette; [data-bdt-shortcut] shows the
// shortcut for this platform (⌘K on Apple devices, Ctrl K elsewhere).
(function () {
if (window.BDTToolSearch) return;

var BDT_IS_MAC = /mac|iphone|ipad/i.test((navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '');
var BDT_SEARCH_ICON = '<svg class="bdt-i" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/></svg>';

var BDTToolSearch = (function () {
  var indexPromise = null;
  var tools = null;
  var overlay, input, list, status;
  var results = [];
  var selected = 0;
  var lastFocus = null;

  function loadIndex() {
    if (!indexPromise) {
      indexPromise = fetch('/tools-index.json', { credentials: 'omit' })
        .then(function (r) {
          if (!r.ok) throw new Error('index ' + r.status);
          return r.json();
        })
        .then(function (data) {
          tools = Array.isArray(data) ? data : [];
          return tools;
        })
        .catch(function (err) {
          indexPromise = null; // allow a retry next time
          throw err;
        });
    }
    return indexPromise;
  }

  function search(query) {
    var q = query.trim().toLowerCase();
    if (!tools) return [];
    if (!q) return tools.slice();
    var words = q.split(/\s+/).filter(Boolean);
    function rank(t) {
      var label = t.label.toLowerCase();
      if (label.indexOf(q) === 0) return 0;
      return words.every(function (w) { return label.indexOf(w) !== -1; }) ? 1 : 2;
    }
    return tools
      .map(function (t, i) { return { t: t, i: i }; })
      .filter(function (x) { return words.every(function (w) { return x.t.text.indexOf(w) !== -1; }); })
      .sort(function (a, b) { return rank(a.t) - rank(b.t) || a.i - b.i; })
      .map(function (x) { return x.t; });
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function build() {
    overlay = document.createElement('div');
    overlay.className = 'bdt-palette';
    overlay.hidden = true;
    overlay.innerHTML =
      '<div class="bdt-palette-panel" role="dialog" aria-modal="true" aria-label="Search tools">' +
        '<div class="bdt-palette-input">' + BDT_SEARCH_ICON +
          '<input type="text" role="combobox" aria-expanded="true" aria-controls="bdt-palette-list" aria-autocomplete="list" autocomplete="off" spellcheck="false" placeholder="Search tools (e.g. json, qr, pdf, lottie)...">' +
          '<kbd>ESC</kbd>' +
        '</div>' +
        '<ul class="bdt-palette-list" id="bdt-palette-list" role="listbox"></ul>' +
        '<div class="bdt-palette-footer"><span><kbd>↑</kbd> <kbd>↓</kbd> to navigate</span><span><kbd>↵</kbd> to open</span><span class="bdt-palette-status"></span></div>' +
      '</div>';
    document.body.appendChild(overlay);
    input = overlay.querySelector('input');
    list = overlay.querySelector('.bdt-palette-list');
    status = overlay.querySelector('.bdt-palette-status');

    overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) close(); });
    input.addEventListener('input', function () { selected = 0; render(); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        var t = results[selected];
        if (t) go(t, selected);
      } else if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'Tab') { e.preventDefault(); } // keep focus in the dialog
    });
    list.addEventListener('mousemove', function (e) {
      var li = e.target.closest('[data-index]');
      if (li && Number(li.dataset.index) !== selected) { selected = Number(li.dataset.index); highlight(); }
    });
    list.addEventListener('click', function (e) {
      var a = e.target.closest('a[data-index]');
      if (a && !e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) track('tool_search_select', { position: Number(a.dataset.index) + 1 });
    });
  }

  function move(delta) {
    if (!results.length) return;
    selected = (selected + delta + results.length) % results.length;
    highlight();
  }

  function highlight() {
    var items = list.querySelectorAll('[data-index]');
    items.forEach(function (el) {
      var on = Number(el.dataset.index) === selected;
      el.classList.toggle('is-selected', on);
      el.setAttribute('aria-selected', on ? 'true' : 'false');
      if (on) {
        input.setAttribute('aria-activedescendant', el.id);
        el.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  function render() {
    if (!tools) {
      list.innerHTML = '<li class="bdt-palette-empty">Loading tools...</li>';
      return;
    }
    results = search(input.value);
    status.textContent = results.length + ' of ' + tools.length + ' tools';
    if (!results.length) {
      list.innerHTML = '<li class="bdt-palette-empty">No tools match “' + esc(input.value.trim()) + '”</li>';
      input.removeAttribute('aria-activedescendant');
      return;
    }
    list.innerHTML = results.map(function (t, i) {
      return '<li role="presentation"><a id="bdt-opt-' + i + '" role="option" data-index="' + i + '" href="' + esc(t.route) + '">' +
        '<span class="bdt-palette-text"><span class="bdt-palette-label">' + esc(t.label) + '</span>' +
        '<span class="bdt-palette-desc">' + esc(t.shortDesc) + '</span></span>' +
        '<span class="bdt-palette-cat">' + esc(t.category) + '</span></a></li>';
    }).join('');
    highlight();
  }

  function go(t, index) {
    track('tool_search_select', { position: index + 1 });
    window.location.href = t.route;
  }

  function track(name, props) {
    try { if (window.Analytics && typeof window.Analytics.track === 'function') window.Analytics.track(name, props); } catch (e) {}
  }

  function open() {
    if (!overlay) build();
    if (!overlay.hidden) return;
    lastFocus = document.activeElement;
    overlay.hidden = false;
    document.documentElement.classList.add('bdt-palette-open');
    input.value = '';
    selected = 0;
    render();
    input.focus();
    track('tool_search_open', { page: (location.pathname === '/' || location.pathname === '/index.html') ? 'home' : 'tool' });
    if (!tools) {
      loadIndex().then(render, function () {
        list.innerHTML = '<li class="bdt-palette-empty">Could not load the tool list. Check your connection, or use <a href="/">All tools</a>.</li>';
      });
    }
  }

  function close() {
    if (!overlay || overlay.hidden) return;
    overlay.hidden = true;
    document.documentElement.classList.remove('bdt-palette-open');
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
  }

  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      if (overlay && !overlay.hidden) close(); else open();
    }
  });

  return { open: open, close: close, loadIndex: loadIndex, search: function (q) { return search(q); } };
})();
window.BDTToolSearch = BDTToolSearch;

document.addEventListener('click', function (e) {
  var trigger = e.target.closest && e.target.closest('[data-bdt-search]');
  if (trigger) {
    e.preventDefault();
    BDTToolSearch.open();
  }
});

function showShortcut() {
  document.querySelectorAll('[data-bdt-shortcut]').forEach(function (el) {
    el.textContent = BDT_IS_MAC ? '⌘K' : 'Ctrl K';
  });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showShortcut);
else showShortcut();
})();
