// src/lib/staticHandoff.ts — Send data from a Next.js tool to a static HTML tool.
//
// The static pages can't read src/lib/crossToolData (that lives in the Next.js
// app's memory/sessionStorage). They read localStorage keys instead:
//  - JSON Formatter: 'json_formatter_input' (read once on load, then removed)
//  - JSON Diff: 'bdt_handoff' via public/assets/js/handoff.js (read once, 10-minute expiry)
// Data stays in this browser. Returns false when it is too large to store.

function store(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/** Open the JSON Formatter with `json` in its input. */
export function sendToJsonFormatter(json: string): boolean {
  if (!store('json_formatter_input', json)) return false;
  // A static HTML page, not a Next.js route: a full page load is required.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.href = '/jsonformatter/';
  return true;
}

/** Open JSON Diff with `left` and `right` filled in and compared. */
export function sendToJsonDiff(left: string, right: string): boolean {
  if (!store('bdt_handoff', JSON.stringify({ to: 'diff', text: left, right, t: Date.now() }))) return false;
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.href = '/jsondiff/';
  return true;
}
