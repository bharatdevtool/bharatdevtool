// kb-checks.js — "Will my form accept it?" checks and size-unit helpers for the
// Resize Image to KB pages. Pure functions: no DOM, safe in Node tests.

/** @typedef {'px' | 'cm' | 'mm' | 'in'} Unit */

/**
 * Convert a printed size to pixels. Forms that give centimetres still check pixels,
 * so we convert at a stated DPI (dots per inch).
 * @param {number} value
 * @param {Unit} unit
 * @param {number} dpi
 */
export function toPixels(value, unit, dpi) {
  if (!(value > 0)) return 0;
  const inches = unit === 'cm' ? value / 2.54 : unit === 'mm' ? value / 25.4 : unit === 'in' ? value : null;
  return Math.max(1, Math.round(inches === null ? value : inches * dpi));
}

/** DD-MM-YYYY, the format Indian exam portals use for "date of photo". @param {Date} d */
export function formatPhotoDate(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}`;
}

/**
 * @typedef {{ id: string, ok: boolean, label: string }} Check
 * @typedef {{
 *   minKB: number, maxKB: number, width?: number, height?: number,
 *   aspect?: number, stamp?: 'required' | 'recommended'
 * }} CheckSpec
 */

/**
 * The checklist shown under each result: what a portal will test, and whether we pass.
 * KB is checked both ways (1 KB = 1000 or 1024 bytes) because portals differ.
 * @param {{ bytes: number, width: number, height: number, mime: string, stamped: boolean }} out
 * @param {CheckSpec} spec
 * @returns {Check[]}
 */
export function checkOutput(out, spec) {
  /** @type {Check[]} */
  const checks = [];
  const kb = out.bytes / 1024;
  const shown = kb < 10 ? kb.toFixed(1) : Math.round(kb);
  const underMax = out.bytes <= spec.maxKB * 1000; // strictest reading of "max KB"
  const overMin = out.bytes >= spec.minKB * 1024; // strictest reading of "min KB"
  checks.push({
    id: 'size',
    ok: underMax && overMin,
    label: spec.minKB > 0 ? `${shown} KB, inside ${spec.minKB}–${spec.maxKB} KB` : `${shown} KB, under ${spec.maxKB} KB`,
  });
  checks.push({ id: 'format', ok: out.mime === 'image/jpeg', label: out.mime === 'image/jpeg' ? 'JPG format' : 'Not a JPG' });
  if (spec.width && spec.height) {
    const exact = out.width === spec.width && out.height === spec.height;
    checks.push({ id: 'pixels', ok: exact, label: exact ? `Exactly ${spec.width} × ${spec.height} px` : `${out.width} × ${out.height} px (needs ${spec.width} × ${spec.height})` });
  } else if (spec.aspect) {
    const ok = Math.abs(out.width / out.height - spec.aspect) / spec.aspect <= 0.02;
    checks.push({ id: 'shape', ok, label: ok ? `Right shape (${out.width} × ${out.height} px)` : `Wrong shape (${out.width} × ${out.height} px)` });
  }
  if (spec.stamp === 'required' || (spec.stamp === 'recommended' && out.stamped)) {
    checks.push({ id: 'stamp', ok: out.stamped, label: out.stamped ? 'Name and date on the photo' : 'Name and date missing' });
  }
  return checks;
}
