// app.js
import { formatJSON, minifyJSON } from "./formatter.js";

let editor;

window.addEventListener("DOMContentLoaded", () => {
  // Initialize CodeMirror
  editor = CodeMirror(document.getElementById("editor"), {
    mode: "application/json",
    lineNumbers: true,
    tabSize: 2,
    theme: "default",
    value: "{\n  \"example\": true\n}"
  });

  // Update status (lines & chars)
  editor.on("change", updateStatus);
  updateStatus();

  // Buttons
  document.getElementById("format-btn").addEventListener("click", formatHandler);
  document.getElementById("minify-btn").addEventListener("click", minifyHandler);
  document.getElementById("copy-btn").addEventListener("click", copyHandler);
  document.getElementById("clear-btn").addEventListener("click", clearHandler);
  document.getElementById("theme-toggle").addEventListener("click", toggleTheme);

  // Upload
  document.getElementById("upload-btn").addEventListener("click", () => {
    document.getElementById("upload-json").click();
  });
  document.getElementById("upload-json").addEventListener("change", handleUpload);

  // Download
  document.getElementById("download-btn").addEventListener("click", handleDownload);

  // Drag & drop
  const dropZone = document.getElementById("drop-zone");
  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });
  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
  dropZone.addEventListener("drop", handleDrop);

  // Keyboard shortcut: Ctrl+Enter
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      formatHandler();
    }
  });

  // Initialize theme
  initTheme();
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
}

// --- Other Functions ---
function updateStatus() {
  const text = editor.getValue();
  const lines = text.split("\n").length;
  const chars = text.length;
  document.getElementById("status").textContent = `Lines: ${lines} • Chars: ${chars}`;
}

function formatHandler() {
  try {
    const formatted = formatJSON(editor.getValue());
    editor.setValue(formatted);
  } catch (err) {
    alert(err.message);
  }
}

function minifyHandler() {
  try {
    const minified = minifyJSON(editor.getValue());
    editor.setValue(minified);
  } catch (err) {
    alert(err.message);
  }
}

function copyHandler() {
  navigator.clipboard.writeText(editor.getValue());
  alert("Copied to clipboard!");
}

function clearHandler() {
  editor.setValue("");
}

function handleUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    editor.setValue(e.target.result);
  };
  reader.readAsText(file);
}

function handleDownload() {
  const blob = new Blob([editor.getValue()], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "data.json";
  a.click();
  URL.revokeObjectURL(url);
}

function handleDrop(e) {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    editor.setValue(event.target.result);
  };
  reader.readAsText(file);
}
