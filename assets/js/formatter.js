// formatter.js

export function formatJSON(text) {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch (err) {
    throw new Error("Invalid JSON: " + err.message);
  }
}

export function minifyJSON(text) {
  try {
    return JSON.stringify(JSON.parse(text));
  } catch (err) {
    throw new Error("Invalid JSON: " + err.message);
  }
}

export function isValidJSON(text) {
  try {
    JSON.parse(text);
    return true;
  } catch (_) {
    return false;
  }
}

export function escapeJSONString(text) {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}

export function unescapeJSONString(text) {
  try {
    // Safest way: wrap in quotes and JSON.parse
    return JSON.parse('"' + text.replace(/"/g, '\\"') + '"');
  } catch (_) {
    // Fallback basic replacements
    return text
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t")
      .replace(/\\\"/g, '"')
      .replace(/\\\\/g, "\\");
  }
}

// --- Repair JSON ---
function stripComments(input) {
  let result = '';
  let inString = false;
  let stringQuote = '';
  let escaped = false;
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    const next = i + 1 < input.length ? input[i + 1] : '';
    if (inString) {
      result += ch;
      if (!escaped && ch === stringQuote) {
        inString = false;
        stringQuote = '';
      }
      escaped = !escaped && ch === '\\';
      i += 1;
      continue;
    }
    if (ch === '"' || ch === '\'') {
      inString = true;
      stringQuote = ch;
      result += ch;
      i += 1;
      continue;
    }
    if (ch === '/' && next === '/') {
      i += 2;
      while (i < input.length && input[i] !== '\n') i += 1;
      continue;
    }
    if (ch === '/' && next === '*') {
      i += 2;
      while (i + 1 < input.length && !(input[i] === '*' && input[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }
    result += ch;
    i += 1;
  }
  return result;
}

function stripBOM(s) { return s.replace(/^\uFEFF/, ''); }

function unwrapJSONP(s) {
  const m = s.match(/^\s*([\$\w\[\]\.]+)\s*\(\s*([\s\S]*)\)\s*;?\s*$/);
  if (m && m[2]) return m[2];
  return s;
}

export function repairJSON(text) {
  let t = String(text);
  t = stripBOM(t);
  t = stripComments(t);
  t = unwrapJSONP(t);
  // Support extracting literals from simple assignments or export default
  let m = t.match(/^(?:var|let|const)\s+[\w\$]+\s*=\s*([\s\S]+?);?\s*$/);
  if (m) t = m[1];
  m = t.match(/^export\s+default\s+([\s\S]+?);?\s*$/);
  if (m) t = m[1];

  // If it looks like a bare property list, wrap in braces
  const trimmed = t.trim();
  if (!/^[{\[]/.test(trimmed) && /[A-Za-z_\$][A-Za-z0-9_\$]*\s*:/.test(trimmed)) {
    t = '{' + trimmed + '}';
  }

  // Remove trailing commas in objects and arrays, and at end of input
  t = t.replace(/,\s*([}\]])/g, '$1');
  t = t.replace(/,\s*$/g, '');

  // Heuristic: insert missing commas between a closing object/array and the next key
  // Example broken input: {"a": { ... }\n"b": 1} → becomes {"a": { ... },\n"b": 1}
  t = t.replace(/([}\]])\s*(?=\")/g, '$1, ');

  // Heuristic: insert missing commas after primitive values (string/number/true/false/null)
  // when immediately followed by the start of another key (a quote)
  // Example: {"a": "x"\n"b": 1} → {"a": "x",\n"b": 1}
  t = t.replace(/("(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?(?:[eE][+\-]?\d+)?|true|false|null)\s*(?=\")/g, '$1, ');

  // Quote unquoted keys (including start of string)
  t = t.replace(/(^|[,{\s])([A-Za-z_\$][A-Za-z0-9_\$]*)\s*:/g, '$1"$2":');
  t = t.replace(/:\s*'([^'\n\r]*)'/g, ': "$1"');
  t = t.replace(/'([^']+)'\s*:/g, '"$1":');
  t = t.replace(/\bundefined\b/g, 'null').replace(/\bNaN\b/g, 'null').replace(/\bInfinity\b/g, 'null').replace(/\b-Infinity\b/g, 'null');
  t = t.replace(/;\s*$/, '');
  try {
    const obj = JSON.parse(t);
    return JSON.stringify(obj, null, 2);
  } catch (err) {
    try {
      const wrapped = t.trim();
      const obj = JSON.parse(wrapped);
      return JSON.stringify(obj, null, 2);
    } catch (_) {
      throw new Error("Could not repair JSON: " + err.message);
    }
  }
}
