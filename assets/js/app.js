// app.js
import { formatJSON, minifyJSON, isValidJSON, escapeJSONString, unescapeJSONString, repairJSON } from "./formatter.js";

let inputEditor;
let outputEditor;
function defaultGreetingJSON() {
  return '{\n  "message": "Built with ❤️ for developers"\n}';
}

window.addEventListener("DOMContentLoaded", () => {
  // Initialize CodeMirror editors
  inputEditor = CodeMirror(document.getElementById("input-editor"), {
    mode: "application/json",
    lineNumbers: true,
    tabSize: 2,
    theme: "default",
    lineWrapping: true,
    foldGutter: true,
    gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"],
    value: ""
  });
  injectPlaceholder();
  outputEditor = CodeMirror(document.getElementById("output-editor"), {
    mode: "application/json",
    lineNumbers: true,
    tabSize: 2,
    theme: "default",
    lineWrapping: true,
    foldGutter: true,
    gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"],
    readOnly: false,
    value: defaultGreetingJSON()
  });

  // JSONEditor integration removed per request

  // Update status + validity on input change
  inputEditor.on("change", () => {
    updateStatus();
    updateValidity();
    updatePlaceholder();
  });
  updateStatus();
  updateValidity();

  // Buttons
  document.getElementById("format-btn").addEventListener("click", formatHandler);
  document.getElementById("minify-btn").addEventListener("click", minifyHandler);
  document.getElementById("escape-btn").addEventListener("click", escapeHandler);
  document.getElementById("unescape-btn").addEventListener("click", unescapeHandler);

  // New toolbars
  const uploadBtn = document.getElementById("input-upload-btn");
  const fetchBtn = document.getElementById("input-fetch-btn");
  const inputClearBtn = document.getElementById("input-clear-btn");
  const inputCopyBtn = document.getElementById("input-copy-btn");
  const inputFsBtn = document.getElementById("input-fullscreen-btn");
  const hiddenUpload = document.getElementById("upload-json");
  if (uploadBtn && hiddenUpload) {
    uploadBtn.addEventListener("click", () => hiddenUpload.click());
  }
  if (fetchBtn) fetchBtn.addEventListener("click", promptFetchIntoInput);
  if (inputClearBtn) inputClearBtn.addEventListener("click", () => { inputEditor.setValue(""); updatePlaceholder(); updateValidity(); });
  if (inputCopyBtn) inputCopyBtn.addEventListener("click", () => navigator.clipboard.writeText(inputEditor.getValue()));
  if (inputFsBtn) inputFsBtn.addEventListener("click", () => toggleFullscreen("input-editor"));

  const outDlBtn = document.getElementById("output-download-btn");
  const outCopyBtn = document.getElementById("output-copy-btn");
  const outClearBtn = document.getElementById("output-clear-btn");
  const outFsBtn = document.getElementById("output-fullscreen-btn");
  if (outDlBtn) outDlBtn.addEventListener("click", toggleDownloadMenu);
  if (outCopyBtn) outCopyBtn.addEventListener("click", () => navigator.clipboard.writeText(outputEditor.getValue()))
  if (outClearBtn) outClearBtn.addEventListener("click", () => outputEditor.setValue(""));
  if (outFsBtn) outFsBtn.addEventListener("click", () => toggleFullscreen("output-editor"));
  document.getElementById("theme-toggle").addEventListener("click", toggleTheme);
  const bookmarkBtn = document.getElementById("bookmark-btn");
  if (bookmarkBtn) bookmarkBtn.addEventListener("click", openBookmarkDialog);
  const bookmarkTextBtn = document.getElementById("bookmark-text-btn");
  if (bookmarkTextBtn) bookmarkTextBtn.addEventListener("click", openBookmarkDialog);
  // Removed expand/collapse controls

  // Upload (hidden input)
  document.getElementById("upload-json").addEventListener("change", handleUpload);

  // Drag & drop on the input editor container itself
  const inputContainer = document.getElementById("input-editor");
  inputContainer.addEventListener("dragover", (e) => {
    e.preventDefault();
  });
  inputContainer.addEventListener("drop", handleDrop);

  // Keyboard shortcut: Ctrl/Cmd + Enter
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      formatHandler();
    }
  });

  // Hook up search for input and output
  initSearch({ editor: inputEditor, input: 'input-search', count: 'input-search-count', prev: 'input-search-prev', next: 'input-search-next' });
  initSearch({ editor: outputEditor, input: 'output-search', count: 'output-search-count', prev: 'output-search-prev', next: 'output-search-next' });

  // Initialize theme
  initTheme();
  syncThemeToggleUI();
  updateThemeLabel();

  // Initialize font size from cookie
  initEditorFontSize();
  const incBtn = document.getElementById('font-inc');
  const decBtn = document.getElementById('font-dec');
  if (incBtn) incBtn.addEventListener('click', () => adjustEditorFont(1));
  if (decBtn) decBtn.addEventListener('click', () => adjustEditorFont(-1));
});

// --- Theme Functions ---
function initTheme() {
  const saved = localStorage.getItem("theme");
  if (saved) {
    document.documentElement.setAttribute("data-theme", saved);
  } else {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.setAttribute("data-theme", prefersDark ? "dark" : "light");
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
  syncThemeToggleUI();
  updateThemeLabel();
}

function syncThemeToggleUI() {
  const control = document.getElementById("theme-toggle");
  if (!control) return;
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  // When checked -> dark
  if (control.type === "checkbox") {
    control.checked = isDark;
  }
}

function updateThemeLabel() {
  const el = document.getElementById("theme-label");
  if (!el) return;
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  el.innerHTML = isDark
    ? '<span>Switch</span><span>Light mode</span>'
    : '<span>Switch</span><span>Dark mode</span>';
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
  if (text.trim().length === 0) {
    if (inputPane) inputPane.classList.remove('valid', 'invalid');
    errorBox.textContent = "";
    return;
  }
  if (isValidJSON(text)) {
    if (inputPane) { inputPane.classList.add('valid'); inputPane.classList.remove('invalid'); }
    errorBox.textContent = "";
  } else {
    if (inputPane) { inputPane.classList.add('invalid'); inputPane.classList.remove('valid'); }
  }
}

function formatHandler() {
  const src = inputEditor.getValue();
  if (src.trim().length === 0) {
    document.getElementById("input-error").textContent = "Empty input";
    outputEditor.setValue(defaultGreetingJSON());
    updateValidity();
    return;
  }
  // If input is already valid JSON, do a plain pretty-format to avoid over-repairing
  if (isValidJSON(src)) {
    try {
      const formatted = formatJSON(src);
      outputEditor.setValue(formatted);
      document.getElementById("input-error").textContent = "";
      updateValidity();
      return;
    } catch (err) {
      // Fallback to repair if formatting somehow fails
    }
  }
  try {
    const repaired = repairJSON(src);
    outputEditor.setValue(repaired);
    document.getElementById("input-error").textContent = "";
    updateValidity();
  } catch (err) {
    document.getElementById("input-error").textContent = err.message;
    outputEditor.setValue("// Invalid JSON: " + err.message);
    updateValidity();
  }
}

function minifyHandler() {
  const src = inputEditor.getValue();
  if (src.trim().length === 0) {
    document.getElementById("input-error").textContent = "Empty input";
    outputEditor.setValue(defaultGreetingJSON());
    updateValidity();
    return;
  }
  try {
    const minified = minifyJSON(inputEditor.getValue());
    outputEditor.setValue(minified);
    updateValidity();
  } catch (err) {
    document.getElementById("input-error").textContent = err.message;
    outputEditor.setValue("// Invalid JSON: " + err.message);
    updateValidity();
  }
}

// fixHandler no longer needed; using formatHandler for repair + format

function escapeHandler() {
  const text = inputEditor.getValue();
  if (text.trim().length === 0) {
    document.getElementById("input-error").textContent = "Empty input";
    outputEditor.setValue(defaultGreetingJSON());
    return;
  }
  const escaped = escapeJSONString(text);
  outputEditor.setValue(escaped);
}

function unescapeHandler() {
  const text = inputEditor.getValue();
  if (text.trim().length === 0) {
    document.getElementById("input-error").textContent = "Empty input";
    outputEditor.setValue(defaultGreetingJSON());
    return;
  }
  const unescaped = unescapeJSONString(text);
  outputEditor.setValue(unescaped);
}

function copyHandler() {
  navigator.clipboard.writeText(outputEditor.getValue() || inputEditor.getValue());
}

function clearHandler() {
  inputEditor.setValue("");
  outputEditor.setValue("");
  updateValidity();
  updatePlaceholder();
}

function handleUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    inputEditor.setValue(e.target.result);
    updatePlaceholder();
  };
  reader.readAsText(file);
}

function handleDownload() {
  const blob = new Blob([outputEditor.getValue() || inputEditor.getValue()], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "data.json";
  a.click();
  URL.revokeObjectURL(url);
}

function downloadWithTransform(kind) {
  let text = outputEditor.getValue() || inputEditor.getValue();
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
  const file = e.dataTransfer.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    inputEditor.setValue(event.target.result);
    updatePlaceholder();
  };
  reader.readAsText(file);
}

// --- Placeholder watermark ---
function injectPlaceholder() {
  const container = document.getElementById("input-editor");
  const el = document.createElement("div");
  el.className = "placeholder";
  el.innerHTML = `
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

  function clearMarks() {
    markers.forEach(m => m.clear());
    markers = [];
  }

  function highlightAll(query) {
    clearMarks();
    matches = [];
    activeIndex = -1;
    const bar = inputEl.closest('.searchbar');
    if (bar) bar.classList.toggle('active', !!(query && query.length >= 3));
    if (!query || query.length < 3) {
      countEl.textContent = '0/0';
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

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      if (inputEl.value && inputEl.value.length >= 3) {
        // clear
        inputEl.value = '';
        highlightAll('');
      } else {
        inputEl.focus();
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
}
