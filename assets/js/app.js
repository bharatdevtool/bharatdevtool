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
  if (outClearBtn) outClearBtn.addEventListener("click", () => {
    outputEditor.setValue("");
    updateOutputStatus();
    updateOutputValidity();
    updateOutputFileSizeIndicator();
  });
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
  initSearch({ editor: outputEditor, input: 'output-search', count: 'output-search-count', prev: 'output-search-prev', next: 'output-search-next' });

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
    errorBox.textContent = "";
    return;
  }
  if (isValidJSON(text)) {
    if (inputPane) { inputPane.classList.add('valid'); inputPane.classList.remove('invalid'); }
    if (validationIndicator) {
      validationIndicator.classList.add('valid');
      validationIndicator.classList.remove('invalid');
      validationIndicator.textContent = '✔';
    }
    errorBox.textContent = "";
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
    document.getElementById("input-error").textContent = "Empty input";
    outputEditor.setValue(defaultGreetingJSON());
    updateValidity();
    updateOutputStatus();
    updateOutputValidity();
    updateOutputFileSizeIndicator();
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
  
  // Performance safeguard for large files
  const fileSize = src.length;
  const maxSize = 2 * 1024 * 1024; // 2MB limit for format (more restrictive due to styling)
  
  if (fileSize > maxSize) {
    const shouldContinue = confirm(
      `Large file detected (${(fileSize / 1024 / 1024).toFixed(1)}MB). ` +
      `Formatting with styling may be very slow. Continue?`
    );
    if (!shouldContinue) {
      return;
    }
  }
  
  // Show processing indicator for large files
  if (fileSize > 512 * 1024) { // 512KB
    document.getElementById("input-error").textContent = "Processing large file...";
  }
  
  // If input is already valid JSON, do a plain pretty-format to avoid over-repairing
  if (isValidJSON(src)) {
  try {
    const formatted = formatJSON(src);
    outputEditor.setValue(formatted);
    document.getElementById("input-error").textContent = "";
    updateValidity();
    updateOutputStatus();
    updateOutputValidity();
    updateOutputFileSizeIndicator();
    
    // Switch back to JSON mode for format
    outputEditor.setOption("mode", "application/json");
    outputEditor.clearOverlays();
    
    // Add URL handlers after formatting (with timeout for large files)
    const timeoutDelay = fileSize > 1024 * 1024 ? 500 : 100;
    setTimeout(() => {
      try {
        addUrlClickHandlers();
        applyEscapeStyling();
        addColorPreviews();
        updateOutputFileSizeIndicator();
        updateOutputStatus();
        updateOutputValidity();
      } catch (stylingErr) {
        document.getElementById("input-error").textContent = "Formatted (styling skipped for performance)";
        updateOutputFileSizeIndicator();
        updateOutputStatus();
        updateOutputValidity();
      }
    }, timeoutDelay);
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
    // Add URL handlers after repair
    setTimeout(() => {
      addUrlClickHandlers();
      applyEscapeStyling();
      addColorPreviews();
      updateOutputFileSizeIndicator();
      updateOutputStatus();
      updateOutputValidity();
    }, 100);
  } catch (err) {
    // Report JSON formatting errors to Sentry (guarded)
    if (typeof Sentry !== 'undefined' && typeof Sentry.captureException === 'function') {
      Sentry.captureException(err, {
        tags: {
          operation: 'json_format',
          fileSize: src.length
        },
        extra: {
          inputPreview: src.substring(0, 200) + (src.length > 200 ? '...' : ''),
          errorMessage: err.message
        }
      });
    }
    
    // Track format failure in analytics
    if (typeof window.Analytics !== 'undefined') {
      window.Analytics.trackFormatFailed({
        page: window.getCurrentPageNameForAnalytics ? window.getCurrentPageNameForAnalytics() : 'JSON Formatter',
        error_message: err.message,
        file_size: src.length,
        lines_before_format: src.split("\n").length
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

function minifyHandler() {
  const src = inputEditor.getValue();
  if (src.trim().length === 0) {
    document.getElementById("input-error").textContent = "Empty input";
    outputEditor.setValue(defaultGreetingJSON());
    updateValidity();
    updateOutputStatus();
    updateOutputValidity();
    updateOutputFileSizeIndicator();
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
    outputEditor.addOverlay({
      token: function(stream) {
        stream.skipToEnd();
        return "plain-text";
      }
    });
    
    updateValidity();
    updateOutputFileSizeIndicator();
    updateOutputStatus();
    updateOutputValidity();
    document.getElementById("input-error").textContent = "";
  } catch (err) {
    // Report minification errors to Sentry (guarded)
    if (typeof Sentry !== 'undefined' && typeof Sentry.captureException === 'function') {
      Sentry.captureException(err, {
        tags: {
          operation: 'json_minify',
          fileSize: src.length
        },
        extra: {
          inputPreview: src.substring(0, 200) + (src.length > 200 ? '...' : ''),
          errorMessage: err.message
        }
      });
    }
    
    // Track minify failure in analytics
    if (typeof window.Analytics !== 'undefined') {
      window.Analytics.trackMinifyFailed({
        page: window.getCurrentPageNameForAnalytics ? window.getCurrentPageNameForAnalytics() : 'JSON Formatter',
        error_message: err.message,
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
    document.getElementById("input-error").textContent = "Empty input";
    outputEditor.setValue(defaultGreetingJSON());
    updateOutputStatus();
    updateOutputValidity();
    updateOutputFileSizeIndicator();
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
    outputEditor.addOverlay({
      token: function(stream) {
        stream.skipToEnd();
        return "plain-text";
      }
    });
    
    document.getElementById("input-error").textContent = "";
    updateOutputFileSizeIndicator();
    updateOutputStatus();
    updateOutputValidity();
  } catch (err) {
    // Track escape failure in analytics
    if (typeof window.Analytics !== 'undefined') {
      window.Analytics.trackEscapeFailed({
        page: window.getCurrentPageNameForAnalytics ? window.getCurrentPageNameForAnalytics() : 'JSON Formatter',
        error_message: err.message
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
    document.getElementById("input-error").textContent = "Empty input";
    outputEditor.setValue(defaultGreetingJSON());
    updateOutputStatus();
    updateOutputValidity();
    updateOutputFileSizeIndicator();
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
    
    // Switch to plain text mode for unescape
    outputEditor.setOption("mode", null);
    outputEditor.setValue(unescaped);
    
    // Apply plain text styling (single green color)
    outputEditor.addOverlay({
      token: function(stream) {
        stream.skipToEnd();
        return "plain-text";
      }
    });
    
    document.getElementById("input-error").textContent = "";
    updateOutputFileSizeIndicator();
    updateOutputStatus();
    updateOutputValidity();
  } catch (err) {
    // Track unescape failure in analytics
    if (typeof window.Analytics !== 'undefined') {
      window.Analytics.trackUnescapeFailed({
        page: window.getCurrentPageNameForAnalytics ? window.getCurrentPageNameForAnalytics() : 'JSON Formatter',
        error_message: err.message
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
  outputEditor.setValue("");
  updateValidity();
  updateOutputStatus();
  updateOutputValidity();
  updateOutputFileSizeIndicator();
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
  // Mobile-responsive placeholder content
  const isMobile = window.innerWidth <= 768;
  el.innerHTML = isMobile ? `
    <h3>📱 Paste your JSON</h3>
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
    <h3>📱 Paste your JSON</h3>
    <p>Tap to paste JSON or click Upload</p>
    <p>Format, validate, repair, minify & escape JSON</p>
  `;
  const desktopContent = `
    <h3>Paste or drop your JSON</h3>
    <p>Drag & drop a .json file here or click Upload</p>
    <p>We can format, validate, repair JS objects to JSON, minify, escape, and unescape.</p>
  `;
  
  if (isMobile && !currentContent.includes('📱')) {
    ph.innerHTML = mobileContent;
  } else if (!isMobile && currentContent.includes('📱')) {
    ph.innerHTML = desktopContent;
  }
}

// Add resize listener for mobile/desktop placeholder updates
window.addEventListener('resize', () => {
  updatePlaceholder();
});

// --- URL Detection and Click Handling ---
function isUrl(text) {
  // Remove quotes first
  const cleanText = text.replace(/^["']|["']$/g, '').trim();
  
  // Try using URL constructor for validation (most reliable)
  try {
    // If it already has a protocol, validate directly
    if (cleanText.match(/^https?:\/\//i)) {
      new URL(cleanText);
      return true;
    }
    // If no protocol, try adding https://
    if (cleanText.match(/^[\da-z][\da-z\.-]*\.[a-z]{2,}/i)) {
      new URL('https://' + cleanText);
      return true;
    }
  } catch (e) {
    // URL constructor failed, not a valid URL
    return false;
  }
  
  return false;
}

function addUrlClickHandlers() {
  // Add click handlers to both editors
  [inputEditor, outputEditor].forEach(editor => {
    if (!editor) return;
    
    // Remove existing listeners
    editor.off('mousedown', handleUrlClick);
    editor.on('mousedown', handleUrlClick);
    
    // Mark URL strings with data attribute
    markUrlStrings(editor);
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

function handleUrlClick(cm, event) {
  const pos = cm.coordsChar({ top: event.clientY, left: event.clientX });
  const token = cm.getTokenAt(pos);
  
  if (token && token.type === 'string') {
    // Check if it's a URL
    const cleanText = token.string.replace(/^["']|["']$/g, '');
    if (isUrl(cleanText)) {
      let url = cleanText;
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      window.open(url, '_blank');
      event.preventDefault();
    }
  }
}

// Apply escape sequence styling directly to DOM elements
function applyEscapeStyling() {
  [inputEditor, outputEditor].forEach(editor => {
    if (!editor) return;
    
    // Get all lines in the editor
    const lineCount = editor.lineCount();
    
    for (let i = 0; i < lineCount; i++) {
      const line = editor.getLine(i);
      if (line) {
        // Find escape sequences in this line
        const escapeRegex = /\\[\\"\/bfnrt]/g;
        let match;
        while ((match = escapeRegex.exec(line)) !== null) {
          const startPos = match.index;
          const endPos = startPos + match[0].length;
          
          // Mark the text with orange color
          editor.markText(
            { line: i, ch: startPos },
            { line: i, ch: endPos },
            { 
              className: 'cm-escape-orange',
              css: 'color: #f59e0b !important; background: transparent !important;'
            }
          );
        }
        
        // Find unicode escape sequences
        const unicodeRegex = /\\u[0-9a-fA-F]{4}/g;
        while ((match = unicodeRegex.exec(line)) !== null) {
          const startPos = match.index;
          const endPos = startPos + match[0].length;
          
          // Mark the text with orange color
          editor.markText(
            { line: i, ch: startPos },
            { line: i, ch: endPos },
            { 
              className: 'cm-unicode-orange',
              css: 'color: #f59e0b !important; background: transparent !important;'
            }
          );
        }
      }
    }
  });
}

// Add color preview for hex color codes
function addColorPreviews() {
  [inputEditor, outputEditor].forEach(editor => {
    if (!editor) return;
    
    // Clear existing color previews
    clearColorPreviews(editor);
    
    const lineCount = editor.lineCount();
    for (let i = 0; i < lineCount; i++) {
      const line = editor.getLine(i);
      if (line) {
        // Find hex color codes in the line - prioritize longer matches first
        const hexRegex = /#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;
        let match;
        let firstColor = null;
        
        while ((match = hexRegex.exec(line)) !== null) {
          if (!firstColor) {
            // match[0] is the full match including #
            firstColor = match[0];
          }
        }
        
        if (firstColor) {
          // Add color preview to this line
          addColorPreviewToLine(editor, i, firstColor);
        }
      }
    }
  });
}

function clearColorPreviews(editor) {
  // Clear all gutter markers for color previews more efficiently
  const lineCount = editor.lineCount();
  for (let i = 0; i < lineCount; i++) {
    // Use the correct CodeMirror API to clear gutter markers
    editor.setGutterMarker(i, 'CodeMirror-linenumbers', null);
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
}
