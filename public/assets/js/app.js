// app.js
import { formatJSON, minifyJSON, isValidJSON, escapeJSONString, unescapeJSONString } from "./formatter.js";
import {
  readInput, stringifyWithPrefs, showInputError, showInputNote, clearInputError, goToError,
  scheduleLiveErrorCheck, initLinkPopover, initPrefs, initQueryBar, initSendTo, initShare,
  revealPathInCode, toast,
} from "./formatter-features.js";
import { parseJSONPrecise } from "./json-raw.js";
import { collapseRanges } from "./json-tools.js";
import {
  pickJsonFile, readInputFile, readDroppedFile, saveToOpenedFile, getOpenedFile,
  forgetOpenedFile, onOpenedFileChange, canSaveInPlace, downloadText,
} from "./json-file.js";

let inputEditor;
let outputEditor;
function defaultGreetingJSON() {
  return '{\n  "message": "Built with ❤️ for developers"\n}';
}

window.addEventListener("DOMContentLoaded", () => {
  // Opened from a share link: that JSON wins over the remembered draft.
  const sharedOnLoad = !!window.__bdtShared;
  // Initialize CodeMirror editors
  inputEditor = CodeMirror(document.getElementById("input-editor"), {
    mode: "application/json",
    lineNumbers: true,
    tabSize: 2,
    theme: "default",
    lineWrapping: true,
    foldGutter: true,
    gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter", "color-preview-gutter"],
    value: ""
  });
  injectPlaceholder();

  // If cURL Tester sent JSON via localStorage, preload it into the input editor
  try {
    const storedFromCurlTester = localStorage.getItem('json_formatter_input');
    if (storedFromCurlTester && storedFromCurlTester.trim().length > 0) {
      inputEditor.setValue(storedFromCurlTester);
      updateStatus();
      updateValidity();
      updatePlaceholder();
      updateFileSizeIndicator();
      // Clear after use to avoid stale content on future visits
      localStorage.removeItem('json_formatter_input');
    }
  } catch (e) {
    // Swallow errors silently to avoid breaking formatter if storage is unavailable
  }

  outputEditor = CodeMirror(document.getElementById("output-editor"), {
    mode: "application/json",
    lineNumbers: true,
    tabSize: 2,
    theme: "default",
    lineWrapping: true,
    foldGutter: true,
    gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter", "color-preview-gutter"],
    readOnly: false,
    value: defaultGreetingJSON()
  });

  // Output editor change - update validity and status
  outputEditor.on("change", () => {
    updateOutputStatus();
    updateOutputValidity();
    updateOutputFileSizeIndicator();
  });

  // Track focus for global search
  inputEditor.on("focus", () => {
    window.currentFocusedEditor = 'input';
  });
  
  outputEditor.on("focus", () => {
    window.currentFocusedEditor = 'output';
  });

  // JSONEditor integration removed per request

  // Update status + validity on input change
  inputEditor.on("change", () => {
    updateStatus();
    updateValidity();
    scheduleLiveErrorCheck(inputEditor, document.getElementById("input-error"));
    updatePlaceholder();
    updateFileSizeIndicator();
    // No styling for input changes - only format button should have styling
  });
  updateStatus();
  updateValidity();
  updateOutputStatus();
  updateOutputValidity();

  // Buttons
  document.getElementById("format-btn").addEventListener("click", formatHandler);
  
  const minifyBtn = document.getElementById("minify-btn");
  const escapeBtn = document.getElementById("escape-btn");
  const unescapeBtn = document.getElementById("unescape-btn");
  
  if (minifyBtn) {
    minifyBtn.addEventListener("click", minifyHandler);
  }
  
  if (escapeBtn) {
    escapeBtn.addEventListener("click", escapeHandler);
  }
  
  if (unescapeBtn) {
    unescapeBtn.addEventListener("click", unescapeHandler);
  }

  // New toolbars
  const uploadBtn = document.getElementById("input-upload-btn");
  const fetchBtn = document.getElementById("input-fetch-btn");
  const inputClearBtn = document.getElementById("input-clear-btn");
  const inputCopyBtn = document.getElementById("input-copy-btn");
  const inputFsBtn = document.getElementById("input-fullscreen-btn");
  const hiddenUpload = document.getElementById("upload-json");
  if (uploadBtn && hiddenUpload) {
    // The File System Access picker (Chrome/Edge) lets Save write back to the same file.
    uploadBtn.addEventListener("click", () => {
      pickJsonFile(() => hiddenUpload.click()).then((text) => { if (text != null) loadFileText(text); });
    });
  }
  if (fetchBtn) fetchBtn.addEventListener("click", promptFetchIntoInput);
  if (inputClearBtn) inputClearBtn.addEventListener("click", () => { inputEditor.setValue(""); forgetOpenedFile(); updatePlaceholder(); updateValidity(); });
  if (inputCopyBtn) inputCopyBtn.addEventListener("click", () => navigator.clipboard.writeText(inputEditor.getValue()));
  if (inputFsBtn) inputFsBtn.addEventListener("click", () => toggleFullscreen("input-editor"));

  const outDlBtn = document.getElementById("output-download-btn");
  const outCopyBtn = document.getElementById("output-copy-btn");
  const outClearBtn = document.getElementById("output-clear-btn");
  const outFsBtn = document.getElementById("output-fullscreen-btn");
  if (outDlBtn) outDlBtn.addEventListener("click", toggleDownloadMenu);
  if (outCopyBtn) outCopyBtn.addEventListener("click", () => navigator.clipboard.writeText(outputEditor.getValue()))
  if (outClearBtn) outClearBtn.addEventListener("click", () => {
    outputEditor.setValue("");
    updateOutputStatus();
    updateOutputValidity();
    updateOutputFileSizeIndicator();
  });
  if (outFsBtn) outFsBtn.addEventListener("click", () => toggleFullscreen(gridActive ? "output-grid" : "output-editor"));
  document.getElementById("theme-toggle").addEventListener("click", toggleTheme);
  const bookmarkBtn = document.getElementById("bookmark-btn");
  if (bookmarkBtn) bookmarkBtn.addEventListener("click", openBookmarkDialog);
  const bookmarkTextBtn = document.getElementById("bookmark-text-btn");
  if (bookmarkTextBtn) bookmarkTextBtn.addEventListener("click", openBookmarkDialog);
  // Removed expand/collapse controls

  // Upload (hidden input)
  document.getElementById("upload-json").addEventListener("change", handleUpload);

  inputEditor.on("change", () => { lastChangedEditor = "input"; });
  outputEditor.on("change", () => { lastChangedEditor = "output"; });

  // Drag & drop a file onto the input editor. CodeMirror has its own file-drop
  // handling that *inserts* the file at the drop point; running both read the
  // file twice and could leave it in the editor twice (invalid JSON). So files
  // are handled here only: preventDefault() tells CodeMirror to skip the event.
  const inputContainer = document.getElementById("input-editor");
  inputContainer.addEventListener("dragover", (e) => {
    e.preventDefault();
  });
  inputEditor.on("drop", (_cm, e) => {
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) handleDrop(e);
  });
  // Drops outside CodeMirror's own area (e.g. on the placeholder).
  inputContainer.addEventListener("drop", (e) => {
    if (!e.defaultPrevented) handleDrop(e);
  });

  // Save edits back to the opened file (Chrome/Edge) or download it under its name.
  const saveBtn = document.getElementById("output-save-btn");
  if (saveBtn) saveBtn.addEventListener("click", saveHandler);
  onOpenedFileChange((file) => {
    if (!saveBtn) return;
    saveBtn.hidden = !file;
    if (file) {
      const tip = canSaveInPlace() ? `Save to ${file.name}` : `Download as ${file.name}`;
      saveBtn.title = tip + " (Ctrl/Cmd+S)";
      saveBtn.setAttribute("aria-label", tip);
      saveBtn.dataset.tip = tip;
    }
  });
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "s" && getOpenedFile()) {
      e.preventDefault();
      saveHandler();
    }
  });

  // Keyboard shortcut: Ctrl/Cmd + Enter
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      formatHandler();
    }
  });

  // Global search shortcut: Ctrl/Cmd + F
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "f") {
      e.preventDefault();
      focusSearchForCurrentEditor();
    }
  });

  // Collapse search bars when clicking outside AND search box is empty
  document.addEventListener("click", (e) => {
    const inputSearchBar = document.getElementById('input-search')?.closest('.searchbar');
    const outputSearchBar = document.getElementById('output-search')?.closest('.searchbar');
    
    // Check if click is outside both search bars
    if (inputSearchBar && !inputSearchBar.contains(e.target)) {
      const inputEl = document.getElementById('input-search');
      // Only collapse if search box is completely empty (no characters at all)
      if (inputEl && inputEl.value.length === 0) {
        inputSearchBar.classList.remove('active');
        // Clear search highlights
        if (window.clearSearchHighlights) {
          window.clearSearchHighlights();
        }
      }
    }
    
    if (outputSearchBar && !outputSearchBar.contains(e.target)) {
      const outputEl = document.getElementById('output-search');
      // Only collapse if search box is completely empty (no characters at all)
      if (outputEl && outputEl.value.length === 0) {
        outputSearchBar.classList.remove('active');
        // Clear search highlights
        if (window.clearSearchHighlights) {
          window.clearSearchHighlights();
        }
      }
    }
  });

  // Hook up search for input and output
  initSearch({ editor: inputEditor, input: 'input-search', count: 'input-search-count', prev: 'input-search-prev', next: 'input-search-next' });
  outputSearch = initSearch({
    editor: outputEditor, input: 'output-search', count: 'output-search-count', prev: 'output-search-prev', next: 'output-search-next',
    // While the Grid is shown, the output search box searches the grid.
    alt: { isActive: () => gridActive && !!grid, search: (q) => grid.search(q), goto: (i) => grid.gotoMatch(i) },
  });

  initOutputViewToggle();
  initFoldToggle();
  initInputCollapse();
  initLinkPopover([inputEditor, outputEditor]);
  initPrefs(reformatOutputWithPrefs);
  queryBar = initQueryBar({ getOutputText: () => outputEditor.getValue(), reveal: revealPath });
  initSendTo({ getOutputText: () => outputEditor.getValue() });
  initShare({
    getOutputText: () => outputEditor.getValue(),
    loadShared: (text) => {
      forgetOpenedFile();
      inputEditor.setValue(text);
      updatePlaceholder();
      formatHandler();
    },
  });

  // Remember the last input across refreshes and closed tabs (draft.js:
  // this browser only, up to 300 lines). Only fills an empty editor, so cURL
  // Tester hand-offs and share links are never overwritten.
  const draft = window.BDTDraft?.attach({
    id: "input",
    get: () => inputEditor.getValue(),
    set: (v) => {
      inputEditor.setValue(v);
      inputEditor.scrollTo(0, 0);
      updateStatus();
      updateValidity();
      updatePlaceholder();
      updateFileSizeIndicator();
    },
  });
  if (draft) {
    inputEditor.on("change", draft.changed);
    if (!sharedOnLoad) draft.restore();
  }

  // Initialize theme
  initTheme();

  // Initialize font size from cookie
  initEditorFontSize();
  const incBtn = document.getElementById('font-inc');
  const decBtn = document.getElementById('font-dec');
  if (incBtn) incBtn.addEventListener('click', () => adjustEditorFont(1));
  if (decBtn) decBtn.addEventListener('click', () => adjustEditorFont(-1));

  // Force refresh highlighting to apply custom colors
  setTimeout(() => {
    if (inputEditor) inputEditor.refresh();
    if (outputEditor) outputEditor.refresh();
    // No styling on page load - only format button should have styling
  }, 100);
});

// --- Output view: Code | Grid ---
// The grid module is only downloaded the first time Grid is opened.
const OUTPUT_VIEW_KEY = 'json_formatter_output_view';
let gridActive = false;
let grid = null;          // API returned by mountGrid()
let gridLoading = null;   // Promise while json-grid-view.js loads
let gridStale = true;     // output changed while the grid was hidden
let gridRenderQueued = false;
let gridWriting = false;  // true while a grid edit is written into the output editor
let outputSearch = null;  // { rerun } from initSearch for the output pane
let queryBar = null;      // { refresh } from initQueryBar
let queryRefreshTimer = null;

function initOutputViewToggle() {
  const codeTab = document.getElementById('view-code-tab');
  const gridTab = document.getElementById('view-grid-tab');
  if (!codeTab || !gridTab) return;
  const trackView = (view) => {
    try { window.Analytics?.trackFormatterFeature?.('view', view); } catch { /* optional */ }
  };
  codeTab.addEventListener('click', () => { setOutputView('code'); trackView('code'); });
  gridTab.addEventListener('click', () => { setOutputView('grid'); trackView('grid'); });
  outputEditor.on('change', () => {
    clearTimeout(queryRefreshTimer);
    queryRefreshTimer = setTimeout(() => queryBar && queryBar.refresh(), 300);
    if (gridWriting) return; // the grid already shows its own edit
    gridStale = true;
    if (gridActive) queueGridRender();
  });
  let saved = null;
  try { saved = localStorage.getItem(OUTPUT_VIEW_KEY); } catch { /* storage blocked */ }
  if (saved === 'grid') setOutputView('grid', { remember: false });
}

function setOutputView(view, { remember = true } = {}) {
  const toGrid = view === 'grid';
  gridActive = toGrid;
  document.getElementById('view-code-tab').setAttribute('aria-selected', String(!toGrid));
  document.getElementById('view-grid-tab').setAttribute('aria-selected', String(toGrid));
  document.getElementById('output-editor').hidden = toGrid;
  // Collapse all is for the code view; the grid has its own expand/collapse buttons.
  const foldBtn = document.getElementById('fold-toggle');
  if (foldBtn) foldBtn.hidden = toGrid;
  document.getElementById('output-grid').hidden = !toGrid;
  if (remember) {
    try { localStorage.setItem(OUTPUT_VIEW_KEY, view); } catch { /* storage blocked */ }
  }
  if (toGrid) {
    queueGridRender();
  } else {
    outputEditor.refresh();
    revealGridSelectionInCode();
    if (outputSearch) outputSearch.rerun();
  }
}

function loadGrid() {
  if (grid) return Promise.resolve(grid);
  if (!gridLoading) {
    gridLoading = import('./json-grid-view.js').then((mod) => {
      grid = mod.mountGrid(document.getElementById('output-grid'), {
        onChange: writeGridEdit,
        notify: (msg) => toast(msg),
        onAction: (action, params) => {
          try { window.Analytics?.trackFormatterFeature?.('grid', action, params || {}); } catch { /* optional */ }
        },
      });
      try { window.Analytics?.trackFormatterFeature?.('grid', 'open'); } catch { /* optional */ }
      return grid;
    });
    gridLoading.catch((err) => {
      gridLoading = null;
      try {
        if (typeof Sentry !== 'undefined' && Sentry.captureMessage) {
          Sentry.captureMessage('json_grid_load_failed', { level: 'warning', extra: { name: err && err.name } });
        }
      } catch { /* monitoring optional */ }
    });
  }
  return gridLoading;
}

/** A grid edit becomes the new output JSON (2-space, same as Format). */
function writeGridEdit(value) {
  gridWriting = true;
  try {
    outputEditor.setValue(stringifyWithPrefs(value, { sort: false }));
  } finally {
    gridWriting = false;
  }
}

function queueGridRender() {
  if (gridRenderQueued) return;
  gridRenderQueued = true;
  loadGrid().then(() => {
    requestAnimationFrame(() => {
      gridRenderQueued = false;
      if (gridActive && gridStale) {
        renderGrid();
        if (outputSearch) outputSearch.rerun();
      }
    });
  }, () => {
    gridRenderQueued = false;
    const box = document.getElementById('output-grid');
    box.textContent = '';
    const p = document.createElement('p');
    p.className = 'json-grid-message';
    p.textContent = 'Grid view could not load. Check your connection and try again.';
    box.appendChild(p);
  });
}

function renderGrid() {
  gridStale = false;
  const text = outputEditor.getValue();
  if (text.trim() === '') {
    grid.showMessage('Nothing to show yet. Paste JSON on the left and press Format.');
    return;
  }
  let value;
  try {
    value = parseJSONPrecise(text);
  } catch {
    grid.showMessage('The output is not valid JSON, so it cannot be shown as a grid. Press Format to repair it.');
    return;
  }
  grid.setData(value);
}

// --- Collapse the input panel to give the output more room ---
const INPUT_COLLAPSED_KEY = 'json_formatter_input_collapsed';

function setInputCollapsed(collapsed) {
  const workspace = document.querySelector('.workspace');
  const btn = document.getElementById('input-collapse-btn');
  if (!workspace || !btn) return;
  workspace.classList.toggle('input-collapsed', collapsed);
  btn.setAttribute('aria-expanded', String(!collapsed));
  btn.title = collapsed ? 'Show the input panel' : 'Collapse the input panel to give the output more room';
  btn.setAttribute('aria-label', collapsed ? 'Show input panel' : 'Collapse input panel');
  try { localStorage.setItem(INPUT_COLLAPSED_KEY, collapsed ? '1' : '0'); } catch { /* storage blocked */ }
  // Editors measure their size; refresh after the layout change.
  requestAnimationFrame(() => { inputEditor.refresh(); outputEditor.refresh(); });
}

function initInputCollapse() {
  const btn = document.getElementById('input-collapse-btn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const collapse = btn.getAttribute('aria-expanded') === 'true';
    setInputCollapsed(collapse);
    try { window.Analytics?.trackFormatterFeature?.('input_panel', collapse ? 'collapse' : 'expand'); } catch { /* optional */ }
  });
  let saved = null;
  try { saved = localStorage.getItem(INPUT_COLLAPSED_KEY); } catch { /* storage blocked */ }
  if (saved === '1') setInputCollapsed(true);
}

// --- Code view: collapse all / expand all ---
let outputCollapsed = false;

function setFoldButton(collapsed) {
  outputCollapsed = collapsed;
  const btn = document.getElementById('fold-toggle');
  if (!btn) return;
  const label = collapsed ? 'Expand all' : 'Collapse all';
  btn.classList.toggle('is-collapsed', collapsed);
  btn.title = label;
  btn.setAttribute('aria-label', label);
  btn.dataset.tip = label;
}

function initFoldToggle() {
  const btn = document.getElementById('fold-toggle');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const cmds = window.CodeMirror && window.CodeMirror.commands;
    if (!cmds || !cmds.unfoldAll) return;
    if (outputCollapsed) {
      // Clear the fold markers directly (unfoldAll would visit every line).
      outputEditor.operation(() => {
        for (const m of outputEditor.getAllMarks()) if (m.__isFold) m.clear();
      });
      setFoldButton(false);
      return;
    }
    // One pass finds every bracket pair (CodeMirror's foldAll rescans the document for
    // each fold and freezes on large files). The outermost { } or [ ] stays open.
    const ranges = collapseRanges(outputEditor.getValue());
    outputEditor.operation(() => {
      for (const r of ranges) {
        outputEditor.foldCode(window.CodeMirror.Pos(r.from.line, 0), {
          rangeFinder: () => ({ from: window.CodeMirror.Pos(r.from.line, r.from.ch), to: window.CodeMirror.Pos(r.to.line, r.to.ch) }),
          scanUp: false,
        }, 'fold');
      }
    });
    outputEditor.scrollTo(null, 0);
    setFoldButton(true);
    try { window.Analytics?.trackFormatterFeature?.('code', 'collapse_all'); } catch { /* optional */ }
  });
  // New output starts fully expanded.
  outputEditor.on('change', (_cm, change) => {
    if (outputCollapsed && change.origin === 'setValue') setFoldButton(false);
  });
}

/** When switching back to Code, select and scroll to the cell picked in the grid. */
function revealGridSelectionInCode() {
  const path = grid && grid.getSelectedPath();
  if (path) revealPathInCode(outputEditor, path);
}

/** Show a path (from a query result) in whichever view is active. */
function revealPath(path) {
  if (gridActive && grid) {
    grid.reveal(path);
  } else if (!revealPathInCode(outputEditor, path)) {
    toast('Press Format to line up the output, then try again.');
  }
}

/** Indent or sort-keys changed: re-write the output (keeps grid edits). */
function reformatOutputWithPrefs() {
  const text = outputEditor.getValue();
  let value;
  try { value = parseJSONPrecise(text); } catch { return; }
  outputEditor.setValue(stringifyWithPrefs(value));
  setTimeout(() => decorateEditors(), 50);
}

// --- Theme Functions ---
// Theme management is now handled by theme.js utility
// These functions are kept for backward compatibility and editor refresh logic

function initTheme() {
  // Use ThemeManager if available, otherwise fallback
  if (typeof window.ThemeManager !== 'undefined') {
    window.ThemeManager.init();
  } else {
    // Fallback: basic initialization
    const saved = localStorage.getItem("theme");
    const theme = saved || "dark"; // Default to dark mode
    document.documentElement.setAttribute("data-theme", theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }
  syncThemeToggleUI();
  updateThemeLabel();
}

function toggleTheme() {
  // Use ThemeManager if available
  if (typeof window.ThemeManager !== 'undefined') {
    window.ThemeManager.toggle();
  } else {
    // Fallback: basic toggle
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    if (next === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }
  
  syncThemeToggleUI();
  updateThemeLabel();
  
  // Refresh editors to apply new theme colors
  setTimeout(() => {
    if (typeof inputEditor !== 'undefined' && inputEditor) inputEditor.refresh();
    if (typeof outputEditor !== 'undefined' && outputEditor) outputEditor.refresh();
    // No styling on theme change - only format button should have styling
  }, 50);
}

function syncThemeToggleUI() {
  const control = document.getElementById("theme-toggle");
  if (!control) return;
  const isDark = (document.documentElement.getAttribute("data-theme") || "dark") === "dark";
  // When checked -> dark
  if (control.type === "checkbox") {
    control.checked = isDark;
  }
}

function updateThemeLabel() {
  const el = document.getElementById("theme-label");
  if (!el) return;
  const isDark = (document.documentElement.getAttribute("data-theme") || "dark") === "dark";
  el.innerHTML = isDark
    ? '<span>Switch</span><span>Light mode</span>'
    : '<span>Switch</span><span>Dark mode</span>';
}

// Listen for theme changes from ThemeManager
if (typeof window !== 'undefined') {
  window.addEventListener('themechange', function(e) {
    syncThemeToggleUI();
    updateThemeLabel();
    setTimeout(() => {
      if (typeof inputEditor !== 'undefined' && inputEditor) inputEditor.refresh();
      if (typeof outputEditor !== 'undefined' && outputEditor) outputEditor.refresh();
    }, 50);
  });
}

// --- Bookmark dialog ---
function openBookmarkDialog() {
  const dialog = document.getElementById("bookmark-dialog");
  if (!dialog) return;
  const link = document.getElementById("bookmark-link");
  if (link) link.value = window.location.href;
  if (typeof dialog.showModal === "function") {
    dialog.showModal();
  } else {
    // Fallback if <dialog> unsupported
    alert("Press Cmd+D (Mac) or Ctrl+D (Windows) to bookmark this page.");
    return;
  }

  const closeBtn = dialog.querySelector(".modal-close");
  if (closeBtn) closeBtn.addEventListener("click", () => dialog.close());
  const copyBtn = document.getElementById("copy-link-btn");
  if (copyBtn) copyBtn.addEventListener("click", copyBookmarkLink);
}

function copyBookmarkLink() {
  const link = document.getElementById("bookmark-link");
  if (!link) return;
  navigator.clipboard.writeText(link.value).then(() => {
    const copyBtn = document.getElementById("copy-link-btn");
    if (copyBtn) {
      const original = copyBtn.textContent;
      copyBtn.textContent = "Copied";
      setTimeout(() => (copyBtn.textContent = original), 1200);
    }
  });
}

// --- Other Functions ---
function updateStatus() {
  const text = inputEditor.getValue();
  const lines = text.split("\n").length;
  const chars = text.length;
  document.getElementById("status").textContent = `Lines: ${lines} • Chars: ${chars}`;
}

function updateValidity() {
  const errorBox = document.getElementById("input-error");
  const text = inputEditor.getValue();
  const inputPane = document.querySelector('.input-pane');
  const validationIndicator = document.getElementById('input-validation-indicator');
  
  if (text.trim().length === 0) {
    if (inputPane) inputPane.classList.remove('valid', 'invalid');
    if (validationIndicator) {
      validationIndicator.classList.remove('valid', 'invalid');
      validationIndicator.textContent = '';
    }
    clearInputError(inputEditor, errorBox);
    return;
  }
  if (isValidJSON(text)) {
    if (inputPane) { inputPane.classList.add('valid'); inputPane.classList.remove('invalid'); }
    if (validationIndicator) {
      validationIndicator.classList.add('valid');
      validationIndicator.classList.remove('invalid');
      validationIndicator.textContent = '✔';
    }
    clearInputError(inputEditor, errorBox);
  } else {
    if (inputPane) { inputPane.classList.add('invalid'); inputPane.classList.remove('valid'); }
    if (validationIndicator) {
      validationIndicator.classList.add('invalid');
      validationIndicator.classList.remove('valid');
      validationIndicator.textContent = '✖';
    }
  }
}

function updateOutputValidity() {
  const text = outputEditor.getValue();
  const outputPane = document.querySelector('.output-pane');
  const validationIndicator = document.getElementById('output-validation-indicator');
  
  if (text.trim().length === 0) {
    if (outputPane) outputPane.classList.remove('valid', 'invalid');
    if (validationIndicator) {
      validationIndicator.classList.remove('valid', 'invalid');
      validationIndicator.textContent = '';
    }
    return;
  }
  if (isValidJSON(text)) {
    if (outputPane) { outputPane.classList.add('valid'); outputPane.classList.remove('invalid'); }
    if (validationIndicator) {
      validationIndicator.classList.add('valid');
      validationIndicator.classList.remove('invalid');
      validationIndicator.textContent = '✔';
    }
  } else {
    if (outputPane) { outputPane.classList.add('invalid'); outputPane.classList.remove('valid'); }
    if (validationIndicator) {
      validationIndicator.classList.add('invalid');
      validationIndicator.classList.remove('valid');
      validationIndicator.textContent = '✖';
    }
  }
}

function updateFileSizeIndicator() {
  const src = inputEditor.getValue();
  const fileSize = src.length;
  const fileSizeKB = (fileSize / 1024).toFixed(1);
  const fileSizeMB = (fileSize / 1024 / 1024).toFixed(1);
  
  // Update file size indicator in the UI
  const sizeIndicator = document.getElementById('file-size-indicator');
  if (sizeIndicator) {
    if (fileSize > 1024 * 1024) {
      sizeIndicator.textContent = `${fileSizeMB}MB`;
      sizeIndicator.className = 'file-size large';
    } else if (fileSize > 1024) {
      sizeIndicator.textContent = `${fileSizeKB}KB`;
      sizeIndicator.className = 'file-size medium';
    } else {
      sizeIndicator.textContent = `${fileSize}B`;
      sizeIndicator.className = 'file-size small';
    }
  }
}

function updateOutputFileSizeIndicator() {
  const src = outputEditor.getValue();
  const fileSize = src.length;
  const fileSizeKB = (fileSize / 1024).toFixed(1);
  const fileSizeMB = (fileSize / 1024 / 1024).toFixed(1);
  
  // Update output file size indicator in the UI
  const sizeIndicator = document.getElementById('output-file-size-indicator');
  if (sizeIndicator) {
    if (fileSize > 1024 * 1024) {
      sizeIndicator.textContent = `${fileSizeMB}MB`;
      sizeIndicator.className = 'file-size large';
    } else if (fileSize > 1024) {
      sizeIndicator.textContent = `${fileSizeKB}KB`;
      sizeIndicator.className = 'file-size medium';
    } else {
      sizeIndicator.textContent = `${fileSize}B`;
      sizeIndicator.className = 'file-size small';
    }
  }
}

function updateOutputStatus() {
  const text = outputEditor.getValue();
  const lines = text.split("\n").length;
  const chars = text.length;
  document.getElementById("output-status").textContent = `Lines: ${lines} • Chars: ${chars}`;
}

function formatHandler() {
  const src = inputEditor.getValue();
  if (src.trim().length === 0) {
    outputEditor.setValue(defaultGreetingJSON());
    updateValidity();
    updateOutputStatus();
    updateOutputValidity();
    updateOutputFileSizeIndicator();
    // Set after the updates above: updateValidity() clears this line for empty input.
    document.getElementById("input-error").textContent = "Paste or upload JSON first";
    return;
  }
  
  // Track format button click
  if (typeof window.Analytics !== 'undefined') {
    const lines = src.split("\n").length;
    const chars = src.length;
    window.Analytics.trackButtonClickFormat({
      page: window.getCurrentPageNameForAnalytics ? window.getCurrentPageNameForAnalytics() : 'JSON Formatter',
      lines_before_format: lines,
      chars_before_format: chars
    });
  }
  
  // Track JSON formatting attempts (guarded Sentry usage)
  if (typeof Sentry !== 'undefined' && typeof Sentry.addBreadcrumb === 'function') {
    Sentry.addBreadcrumb({
      message: 'JSON formatting attempted',
      category: 'user-action',
      level: 'info',
      data: {
        inputLength: src.length,
        hasContent: src.trim().length > 0
      }
    });
  }
  
  const fileSize = src.length;
  
  // Show processing indicator for large files
  if (fileSize > 512 * 1024) { // 512KB
    document.getElementById("input-error").textContent = "Processing large file...";
  }
  
  // Strict JSON, then NDJSON, then JSON5 / JS objects, then heuristic repair.
  const result = readInput(src);
  const errorBox = document.getElementById("input-error");
  if (result.ok) {
    let formatted;
    try {
      formatted = stringifyWithPrefs(result.value);
    } catch (err) {
      showInputNote(inputEditor, errorBox, "Could not format this JSON.");
      return;
    }
    outputEditor.setOption("mode", "application/json");
    setPlainTextOverlay(false);
    outputEditor.setValue(formatted);
    updateValidity();
    if (result.note) showInputNote(inputEditor, errorBox, result.note);
    else clearInputError(inputEditor, errorBox);
    updateOutputStatus();
    updateOutputValidity();
    updateOutputFileSizeIndicator();

    // Decorations (links, escapes, colour swatches) after the paint; slower for big files.
    const timeoutDelay = fileSize > 1024 * 1024 ? 500 : 100;
    setTimeout(() => {
      try {
        decorateEditors();
      } catch {
        showInputNote(inputEditor, errorBox, "Formatted (styling skipped for performance)");
      }
      updateOutputFileSizeIndicator();
      updateOutputStatus();
      updateOutputValidity();
    }, timeoutDelay);
    return;
  }

  // Track format failure in analytics
  if (typeof window.Analytics !== 'undefined') {
    window.Analytics.trackFormatFailed({
      page: window.getCurrentPageNameForAnalytics ? window.getCurrentPageNameForAnalytics() : 'JSON Formatter',
      error_message: 'invalid_json', // never the error text: it quotes the user's input
      file_size: src.length,
      lines_before_format: src.split("\n").length
    });
  }

  const { error } = result;
  updateValidity();
  showInputError(inputEditor, errorBox, error);
  goToError(inputEditor, error);
  outputEditor.setValue(`// Invalid JSON at line ${error.line}, column ${error.column}: ${error.message}`);
  updateOutputStatus();
  updateOutputValidity();
  updateOutputFileSizeIndicator();
}

function minifyHandler() {
  const src = inputEditor.getValue();
  if (src.trim().length === 0) {
    outputEditor.setValue(defaultGreetingJSON());
    updateValidity();
    updateOutputStatus();
    updateOutputValidity();
    updateOutputFileSizeIndicator();
    // Set after the updates above: updateValidity() clears this line for empty input.
    document.getElementById("input-error").textContent = "Paste or upload JSON first";
    return;
  }
  
  // Track minify button click
  if (typeof window.Analytics !== 'undefined') {
    window.Analytics.trackButtonClickMinify({
      page: window.getCurrentPageNameForAnalytics ? window.getCurrentPageNameForAnalytics() : 'JSON Formatter'
    });
  }
  
  // Performance safeguard for large files
  const fileSize = src.length;
  const maxSize = 5 * 1024 * 1024; // 5MB limit
  
  if (fileSize > maxSize) {
    const shouldContinue = confirm(
      `Large file detected (${(fileSize / 1024 / 1024).toFixed(1)}MB). ` +
      `Processing may be slow. Continue?`
    );
    if (!shouldContinue) {
      return;
    }
  }
  
  // Show processing indicator for large files
  if (fileSize > 1024 * 1024) { // 1MB
    document.getElementById("input-error").textContent = "Processing large file...";
  }
  
  try {
    const minified = minifyJSON(src);
    
    // Switch to plain text mode for minify
    outputEditor.setOption("mode", null);
    outputEditor.setValue(minified);
    
    // Apply plain text styling (single green color)
    setPlainTextOverlay(true);
    
    updateValidity();
    updateOutputFileSizeIndicator();
    updateOutputStatus();
    updateOutputValidity();
    document.getElementById("input-error").textContent = "";
  } catch (err) {
    
    // Track minify failure in analytics
    if (typeof window.Analytics !== 'undefined') {
      window.Analytics.trackMinifyFailed({
        page: window.getCurrentPageNameForAnalytics ? window.getCurrentPageNameForAnalytics() : 'JSON Formatter',
        error_message: 'invalid_json',
        file_size: src.length
      });
    }
    
    document.getElementById("input-error").textContent = err.message;
    outputEditor.setValue("// Invalid JSON: " + err.message);
    updateValidity();
    updateOutputStatus();
    updateOutputValidity();
    updateOutputFileSizeIndicator();
  }
}

// fixHandler no longer needed; using formatHandler for repair + format

function escapeHandler() {
  const text = inputEditor.getValue();
  if (text.trim().length === 0) {
    outputEditor.setValue(defaultGreetingJSON());
    updateOutputStatus();
    updateOutputValidity();
    updateOutputFileSizeIndicator();
    // Set after the updates above: updateValidity() clears this line for empty input.
    document.getElementById("input-error").textContent = "Paste or upload JSON first";
    return;
  }
  
  // Track escape button click
  if (typeof window.Analytics !== 'undefined') {
    window.Analytics.trackButtonClickEscape({
      page: window.getCurrentPageNameForAnalytics ? window.getCurrentPageNameForAnalytics() : 'JSON Formatter'
    });
  }
  
  // Performance safeguard for large files
  const fileSize = text.length;
  const maxSize = 5 * 1024 * 1024; // 5MB limit
  
  if (fileSize > maxSize) {
    const shouldContinue = confirm(
      `Large file detected (${(fileSize / 1024 / 1024).toFixed(1)}MB). ` +
      `Processing may be slow. Continue?`
    );
    if (!shouldContinue) {
      return;
    }
  }
  
  // Show processing indicator for large files
  if (fileSize > 1024 * 1024) { // 1MB
    document.getElementById("input-error").textContent = "Processing large file...";
  }
  
  try {
    const escaped = escapeJSONString(text);
    
    // Switch to plain text mode for escape
    outputEditor.setOption("mode", null);
    outputEditor.setValue(escaped);
    
    // Apply plain text styling (single green color)
    setPlainTextOverlay(true);
    
    document.getElementById("input-error").textContent = "";
    updateOutputFileSizeIndicator();
    updateOutputStatus();
    updateOutputValidity();
  } catch (err) {
    // Track escape failure in analytics
    if (typeof window.Analytics !== 'undefined') {
      window.Analytics.trackEscapeFailed({
        page: window.getCurrentPageNameForAnalytics ? window.getCurrentPageNameForAnalytics() : 'JSON Formatter',
        error_message: 'escape_failed'
      });
    }
    
    document.getElementById("input-error").textContent = err.message;
    outputEditor.setValue("// Error: " + err.message);
    updateOutputFileSizeIndicator();
    updateOutputStatus();
    updateOutputValidity();
  }
}

function unescapeHandler() {
  const text = inputEditor.getValue();
  if (text.trim().length === 0) {
    outputEditor.setValue(defaultGreetingJSON());
    updateOutputStatus();
    updateOutputValidity();
    updateOutputFileSizeIndicator();
    // Set after the updates above: updateValidity() clears this line for empty input.
    document.getElementById("input-error").textContent = "Paste or upload JSON first";
    return;
  }
  
  // Track unescape button click
  if (typeof window.Analytics !== 'undefined') {
    window.Analytics.trackButtonClickUnescape({
      page: window.getCurrentPageNameForAnalytics ? window.getCurrentPageNameForAnalytics() : 'JSON Formatter'
    });
  }
  
  // Performance safeguard for large files
  const fileSize = text.length;
  const maxSize = 5 * 1024 * 1024; // 5MB limit
  
  if (fileSize > maxSize) {
    const shouldContinue = confirm(
      `Large file detected (${(fileSize / 1024 / 1024).toFixed(1)}MB). ` +
      `Processing may be slow. Continue?`
    );
    if (!shouldContinue) {
      return;
    }
  }
  
  // Show processing indicator for large files
  if (fileSize > 1024 * 1024) { // 1MB
    document.getElementById("input-error").textContent = "Processing large file...";
  }
  
  try {
    const unescaped = unescapeJSONString(text);

    if (isValidJSON(unescaped)) {
      // Escaped JSON (e.g. copied from a log): show it as formatted JSON.
      setPlainTextOverlay(false);
      outputEditor.setOption("mode", "application/json");
      outputEditor.setValue(formatJSON(unescaped));
    } else {
      // Switch to plain text mode for unescape
      outputEditor.setOption("mode", null);
      outputEditor.setValue(unescaped);

      // Apply plain text styling (single green color)
      setPlainTextOverlay(true);
    }
    
    document.getElementById("input-error").textContent = "";
    updateOutputFileSizeIndicator();
    updateOutputStatus();
    updateOutputValidity();
  } catch (err) {
    // Track unescape failure in analytics
    if (typeof window.Analytics !== 'undefined') {
      window.Analytics.trackUnescapeFailed({
        page: window.getCurrentPageNameForAnalytics ? window.getCurrentPageNameForAnalytics() : 'JSON Formatter',
        error_message: 'unescape_failed'
      });
    }
    
    document.getElementById("input-error").textContent = err.message;
    outputEditor.setValue("// Error: " + err.message);
    updateOutputFileSizeIndicator();
    updateOutputStatus();
    updateOutputValidity();
  }
}

function copyHandler() {
  navigator.clipboard.writeText(outputEditor.getValue() || inputEditor.getValue());
}

function clearHandler() {
  inputEditor.setValue("");
  forgetOpenedFile();
  outputEditor.setValue("");
  updateValidity();
  updateOutputStatus();
  updateOutputValidity();
  updateOutputFileSizeIndicator();
  updatePlaceholder();
}

function handleUpload(event) {
  const file = event.target.files[0];
  event.target.value = ""; // so choosing the same file again still fires "change"
  if (!file) return;
  readInputFile(file).then(loadFileText);
}

/** Show a file the user opened (upload or drop) in the input editor. */
function loadFileText(text) {
  inputEditor.setValue(text);
  inputEditor.scrollTo(0, 0);
  updatePlaceholder();
  updateValidity();
  const file = getOpenedFile();
  if (file) {
    toast(canSaveInPlace()
      ? `Opened ${file.name}. Edit it, then press Save (Ctrl/Cmd+S) to update the file.`
      : `Opened ${file.name}. Save downloads your edited copy with the same name.`, { duration: 5000 });
  }
}

/**
 * The JSON a download or save writes: whichever editor changed last. Opening a
 * file updates the input; Format, Minify and grid edits update the output; typing
 * updates the editor you type in. So the output left over from earlier JSON is
 * never written into a file that was just opened.
 */
let lastChangedEditor = "output";
function currentJsonText() {
  const [first, second] = lastChangedEditor === "input" ? [inputEditor, outputEditor] : [outputEditor, inputEditor];
  return first.getValue() || second.getValue();
}

async function saveHandler() {
  const file = getOpenedFile();
  if (!file) return;
  const text = currentJsonText();
  try {
    parseJSONPrecise(text);
  } catch {
    toast("This JSON has errors. Fix them before saving, so the file is not damaged.", { duration: 5000 });
    return;
  }
  try {
    const result = await saveToOpenedFile(text);
    if (result === "saved") toast(`Saved to ${file.name}`);
    else if (result === "downloaded") toast(`Downloaded as ${file.name}. This browser cannot write to the original file.`, { duration: 5000 });
    else toast("Not saved: permission to edit the file was not given.");
    trackFileSave(result);
  } catch {
    toast("Could not save the file.");
  }
}

function trackFileSave(result) {
  // Fixed labels only: never the file name or contents.
  try { window.Analytics?.trackFormatterFeature?.("file", "save", { result }); } catch { /* optional */ }
}

function handleDownload() {
  downloadText(currentJsonText(), getOpenedFile()?.name || "data.json");
}

function downloadWithTransform(kind) {
  let text = currentJsonText();
  try {
    if (kind === 'formatted') text = formatJSON(text);
    if (kind === 'minified') text = minifyJSON(text);
    if (kind === 'escaped') text = escapeJSONString(text);
    if (kind === 'unescaped') text = unescapeJSONString(text);
  } catch (err) {
    // If parsing fails for formatted/minified, fall back to raw text
  }
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `data-${kind}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function toggleDownloadMenu(e) {
  e.stopPropagation();
  const container = document.getElementById('download-menu');
  if (!container) return;
  container.classList.toggle('open');
}

// Menu item handlers
document.addEventListener('click', (e) => {
  const container = document.getElementById('download-menu');
  if (container && !container.contains(e.target)) {
    container.classList.remove('open');
  }
});

const dlFormatted = document.getElementById('dl-formatted');
const dlMinified = document.getElementById('dl-minified');
const dlEscaped = document.getElementById('dl-escaped');
const dlUnescaped = document.getElementById('dl-unescaped');
if (dlFormatted) dlFormatted.addEventListener('click', () => { downloadWithTransform('formatted'); document.getElementById('download-menu')?.classList.remove('open'); });
if (dlMinified) dlMinified.addEventListener('click', () => { downloadWithTransform('minified'); document.getElementById('download-menu')?.classList.remove('open'); });
if (dlEscaped) dlEscaped.addEventListener('click', () => { downloadWithTransform('escaped'); document.getElementById('download-menu')?.classList.remove('open'); });
if (dlUnescaped) dlUnescaped.addEventListener('click', () => { downloadWithTransform('unescaped'); document.getElementById('download-menu')?.classList.remove('open'); });

function promptFetchIntoInput() {
  const url = prompt("Enter JSON URL");
  if (!url) return;
  fetch(url)
    .then((r) => r.text())
    .then((t) => {
      forgetOpenedFile();
      inputEditor.setValue(t);
      updatePlaceholder();
      updateValidity();
    })
    .catch((e) => {
      document.getElementById("input-error").textContent = e.message;
    });
}

function toggleFullscreen(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!document.fullscreenElement) {
    el.requestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
}

// --- Font size persistence ---
function getCookie(name) {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}
function setCookie(name, value, days) {
  const d = new Date();
  d.setTime(d.getTime() + (days*24*60*60*1000));
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${d.toUTCString()}; path=/`;
}
function applyEditorFontSize(px) {
  const size = Math.max(10, Math.min(24, px));
  document.documentElement.style.setProperty('--cm-font-size', size + 'px');
  // CodeMirror requires CSS; we override via root custom property
  const cmEls = document.querySelectorAll('.CodeMirror');
  cmEls.forEach(el => el.style.fontSize = size + 'px');
}
function initEditorFontSize() {
  const saved = parseInt(getCookie('editorFontPx'), 10);
  const size = Number.isFinite(saved) ? saved : 13;
  applyEditorFontSize(size);
}
function adjustEditorFont(delta) {
  const current = parseInt(getComputedStyle(document.querySelector('.CodeMirror')).fontSize, 10) || 13;
  const next = Math.max(10, Math.min(24, current + delta));
  applyEditorFontSize(next);
  setCookie('editorFontPx', String(next), 365);
}

function handleDrop(e) {
  e.preventDefault();
  // Synchronously, inside the event: the browser only gives out the file handle now.
  const reading = readDroppedFile(e);
  if (reading) reading.then(loadFileText);
}

// --- Placeholder watermark ---
function injectPlaceholder() {
  const container = document.getElementById("input-editor");
  const el = document.createElement("div");
  el.className = "placeholder";
  // Mobile-responsive placeholder content
  const isMobile = window.innerWidth <= 768;
  el.innerHTML = isMobile ? `
    <h3><svg class="bdt-i" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:inline-block;vertical-align:-0.125em;flex-shrink:0"><path d="M11 14h10"/><path d="M16 4h2a2 2 0 0 1 2 2v1.344"/><path d="m17 18 4-4-4-4"/><path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 1.793-1.113"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg> Paste your JSON</h3>
    <p>Tap to paste JSON or click Upload</p>
    <p>Format, validate, repair, minify & escape JSON</p>
  ` : `
    <h3>Paste or drop your JSON</h3>
    <p>Drag & drop a .json file here or click Upload</p>
    <p>We can format, validate, repair JS objects to JSON, minify, escape, and unescape.</p>
  `;
  container.appendChild(el);
  updatePlaceholder();
}

function updatePlaceholder() {
  const container = document.getElementById("input-editor");
  const ph = container.querySelector(".placeholder");
  if (!ph) return;
  const hasContent = inputEditor.getValue().trim().length > 0;
  ph.style.display = hasContent ? "none" : "flex";
  
  // Update content for mobile/desktop changes
  const isMobile = window.innerWidth <= 768;
  const currentContent = ph.innerHTML;
  const mobileContent = `
    <h3><svg class="bdt-i" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:inline-block;vertical-align:-0.125em;flex-shrink:0"><path d="M11 14h10"/><path d="M16 4h2a2 2 0 0 1 2 2v1.344"/><path d="m17 18 4-4-4-4"/><path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 1.793-1.113"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg> Paste your JSON</h3>
    <p>Tap to paste JSON or click Upload</p>
    <p>Format, validate, repair, minify & escape JSON</p>
  `;
  const desktopContent = `
    <h3>Paste or drop your JSON</h3>
    <p>Drag & drop a .json file here or click Upload</p>
    <p>We can format, validate, repair JS objects to JSON, minify, escape, and unescape.</p>
  `;
  
  if (isMobile && !currentContent.includes('Tap to paste')) {
    ph.innerHTML = mobileContent;
  } else if (!isMobile && currentContent.includes('Tap to paste')) {
    ph.innerHTML = desktopContent;
  }
}

// Add resize listener for mobile/desktop placeholder updates
window.addEventListener('resize', () => {
  updatePlaceholder();
});


// Plain-text overlay used for minified/escaped/unescaped output. CodeMirror
// only removes an overlay given the same object, so keep a single instance.
const PLAIN_TEXT_OVERLAY = {
  token(stream) {
    stream.skipToEnd();
    return "plain-text";
  }
};

function setPlainTextOverlay(on) {
  outputEditor.removeOverlay(PLAIN_TEXT_OVERLAY);
  if (on) outputEditor.addOverlay(PLAIN_TEXT_OVERLAY);
}

// Decorations (clickable URLs, orange escape sequences, colour swatches) are
// cosmetic and touch every line, so: batch them in one CodeMirror operation,
// clear the previous ones first, and skip them on very large documents.
const DECORATION_MAX_LINES = 5000;
const DECORATION_MAX_CHARS = 200 * 1024; // e.g. one huge minified line
const DECORATION_CLASSES = /\bcm-(url|escape|escape-orange|unicode|unicode-orange)\b/;

function decorateEditors() {
  [inputEditor, outputEditor].forEach(editor => {
    if (!editor) return;
    editor.operation(() => {
      editor.getAllMarks().forEach(m => { if (m.className && DECORATION_CLASSES.test(m.className)) m.clear(); });
      editor.clearGutter('CodeMirror-linenumbers');
      if (editor.lineCount() > DECORATION_MAX_LINES || editor.getValue().length > DECORATION_MAX_CHARS) return;
      markUrlStrings(editor);       // also marks escape and unicode sequences
      addColorPreviewsTo(editor);
    });
  });
}

function markUrlStrings(editor) {
  const doc = editor.getDoc();
  const content = doc.getValue();
  const lines = content.split('\n');
  
  lines.forEach((line, lineIndex) => {
    // Find all string tokens that are URLs
    const stringMatches = line.match(/"([^"]*https?:\/\/[^"]*)"/g);
    if (stringMatches) {
      stringMatches.forEach(match => {
        const startPos = { line: lineIndex, ch: line.indexOf(match) };
        const endPos = { line: lineIndex, ch: startPos.ch + match.length };
        
        // Add marker for URL
        editor.markText(startPos, endPos, {
          className: 'cm-string cm-url',
          attributes: { 'data-url': 'true' }
        });
      });
    }
    
    // Find and mark escape sequences and unicode sequences
    markEscapeSequences(editor, line, lineIndex);
  });
}

function markEscapeSequences(editor, line, lineIndex) {
  // Find escape sequences like \" and \n
  const escapeMatches = line.match(/\\[\\"\/bfnrt]/g);
  if (escapeMatches) {
    escapeMatches.forEach(match => {
      const startPos = line.indexOf(match);
      if (startPos !== -1) {
        editor.markText(
          { line: lineIndex, ch: startPos },
          { line: lineIndex, ch: startPos + match.length },
          { 
            className: 'cm-string cm-escape',
            css: 'color: #f59e0b !important;'
          }
        );
      }
    });
  }
  
  // Find unicode escape sequences like \u003d
  const unicodeMatches = line.match(/\\u[0-9a-fA-F]{4}/g);
  if (unicodeMatches) {
    unicodeMatches.forEach(match => {
      const startPos = line.indexOf(match);
      if (startPos !== -1) {
        editor.markText(
          { line: lineIndex, ch: startPos },
          { line: lineIndex, ch: startPos + match.length },
          { 
            className: 'cm-string cm-unicode-escape',
            css: 'color: #f59e0b !important;'
          }
        );
      }
    });
  }
}

// Apply escape sequence styling directly to DOM elements
function addColorPreviewsTo(editor) {
  const lineCount = editor.lineCount();
  const hexRegex = /#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/;
  for (let i = 0; i < lineCount; i++) {
    const match = hexRegex.exec(editor.getLine(i) || '');
    if (match) addColorPreviewToLine(editor, i, match[0]);
  }
}


function addColorPreviewToLine(editor, lineNumber, hexColor) {
  // Replace the line number with color preview
  editor.setGutterMarker(lineNumber, 'CodeMirror-linenumbers', createColorPreviewElement(hexColor));
}

function createColorPreviewElement(hexColor) {
  const element = document.createElement('div');
  element.className = 'color-preview';
  element.style.backgroundColor = hexColor;
  element.title = `Click to copy: ${hexColor}`;
  
  // Add click handler to copy hex color
  element.addEventListener('click', (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(hexColor).then(() => {
      // Show temporary feedback
      const originalTitle = element.title;
      element.title = 'Copied!';
      setTimeout(() => {
        element.title = originalTitle;
      }, 1000);
    });
  });
  
  return element;
}

// Focus search for the currently active editor
function focusSearchForCurrentEditor() {
  let targetSearchInput = null;
  
  // Use tracked focus state if available
  if (window.currentFocusedEditor === 'output') {
    targetSearchInput = document.getElementById('output-search');
  } else if (window.currentFocusedEditor === 'input') {
    targetSearchInput = document.getElementById('input-search');
  } else {
    // Fallback: check which editor has focus
    const activeElement = document.activeElement;
    const inputEditorContainer = document.getElementById('input-editor');
    const outputEditorContainer = document.getElementById('output-editor');
    
    if (outputEditorContainer && (outputEditorContainer.contains(activeElement) || 
        outputEditor.hasFocus() || 
        activeElement.closest('#output-editor'))) {
      targetSearchInput = document.getElementById('output-search');
    } else {
      // Default to input search
      targetSearchInput = document.getElementById('input-search');
    }
  }
  
  if (targetSearchInput) {
    // Focus the search input
    targetSearchInput.focus();
    targetSearchInput.select();
    
    // Expand search bar immediately
    const bar = targetSearchInput.closest('.searchbar');
    if (bar) bar.classList.add('active');
  }
}

// Removed toggle and expand/collapse helpers

// --- Search helpers ---
function initSearch(cfg) {
  const inputEl = document.getElementById(cfg.input);
  const countEl = document.getElementById(cfg.count);
  const prevBtn = document.getElementById(cfg.prev);
  const nextBtn = document.getElementById(cfg.next);
  if (!inputEl || !countEl || !prevBtn || !nextBtn) return;
  const toggleBtn = inputEl.parentElement.querySelector('.search-toggle');

  let matches = [];
  let activeIndex = -1;
  let markers = [];
  let altSearchTimer = null;

  function clearMarks() {
    markers.forEach(m => m.clear());
    markers = [];
  }

  // Expose clearMarks function for external use
  window.clearSearchHighlights = clearMarks;

  function highlightAll(query) {
    clearMarks();
    matches = [];
    activeIndex = -1;
    const bar = inputEl.closest('.searchbar');
    // Keep search bar expanded if there's any content, search starts with 1+ character
    if (bar) bar.classList.toggle('active', !!(query && query.length > 0));
    if (!query || query.length < 1) {
      countEl.textContent = '0/0';
      clearTimeout(altSearchTimer);
      if (cfg.alt && cfg.alt.isActive()) cfg.alt.search('');
      return;
    }
    if (cfg.alt && cfg.alt.isActive()) {
      // The grid re-renders on search, so wait until typing pauses.
      clearTimeout(altSearchTimer);
      altSearchTimer = setTimeout(() => {
        const n = cfg.alt.search(query);
        matches = new Array(n).fill(null);
        if (n) {
          activeIndex = 0;
          gotoIndex(0);
        }
        countEl.textContent = `${n ? 1 : 0}/${n}${n >= 300 ? '+' : ''}`;
      }, 250);
      return;
    }
    const cm = cfg.editor;
    const doc = cm.getDoc();
    const fullText = doc.getValue();
    const lower = fullText.toLowerCase();
    const q = query.toLowerCase();
    let idx = 0;
    while ((idx = lower.indexOf(q, idx)) !== -1) {
      const from = doc.posFromIndex(idx);
      const to = doc.posFromIndex(idx + q.length);
      const mark = cm.markText(from, to, { className: 'cm-search-match' });
      markers.push(mark);
      matches.push({ from, to });
      idx += q.length;
    }
    if (matches.length) {
      activeIndex = 0;
      gotoIndex(activeIndex);
    }
    countEl.textContent = `${matches.length ? activeIndex + 1 : 0}/${matches.length}`;
  }

  function gotoIndex(i) {
    if (cfg.alt && cfg.alt.isActive()) {
      cfg.alt.goto(i);
      return;
    }
    const cm = cfg.editor;
    markers.forEach((m, mi) => m.className = mi === i ? 'cm-search-match cm-search-active' : 'cm-search-match');
    if (matches[i]) {
      cm.scrollIntoView(matches[i].from, 100);
      cm.setSelection(matches[i].from, matches[i].to);
    }
  }

  inputEl.addEventListener('input', () => {
    highlightAll(inputEl.value);
  });

  // Expand search bar immediately on focus/click
  inputEl.addEventListener('focus', () => {
    const bar = inputEl.closest('.searchbar');
    if (bar) bar.classList.add('active');
  });

  inputEl.addEventListener('click', () => {
    const bar = inputEl.closest('.searchbar');
    if (bar) bar.classList.add('active');
  });

  // Collapse search bar when focus leaves AND search box is empty
  inputEl.addEventListener('blur', () => {
    // Small delay to allow for clicking on search controls
    setTimeout(() => {
      const bar = inputEl.closest('.searchbar');
      const isSearchBarFocused = bar && bar.contains(document.activeElement);
      // Only collapse if search bar is not focused AND search box is completely empty
      if (!isSearchBarFocused && inputEl.value.length === 0) {
        bar.classList.remove('active');
        highlightAll(''); // Clear highlights
      }
    }, 150);
  });

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      if (inputEl.value && inputEl.value.length >= 1) {
        // clear
        inputEl.value = '';
        highlightAll('');
      } else {
        inputEl.focus();
        // Expand search bar immediately
        const bar = inputEl.closest('.searchbar');
        if (bar) bar.classList.add('active');
      }
    });
  }

  prevBtn.addEventListener('click', () => {
    if (!matches.length) return;
    activeIndex = (activeIndex - 1 + matches.length) % matches.length;
    gotoIndex(activeIndex);
    countEl.textContent = `${activeIndex + 1}/${matches.length}`;
  });
  nextBtn.addEventListener('click', () => {
    if (!matches.length) return;
    activeIndex = (activeIndex + 1) % matches.length;
    gotoIndex(activeIndex);
    countEl.textContent = `${activeIndex + 1}/${matches.length}`;
  });

  return { rerun: () => highlightAll(inputEl.value) };
}
