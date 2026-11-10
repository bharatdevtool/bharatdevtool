// Find sensitive numbers in a page's text (for Redact). Pure: takes text runs with their
// positions (fractions of the displayed page) and returns boxes to black out.

export interface TextRun {
  str: string;
  /** Box of the whole run as fractions of the displayed page (top-left origin). */
  u: number;
  v: number;
  w: number;
  h: number;
  /**
   * Optional start offset of each character as a fraction of the run width (length str.length + 1,
   * last = 1). Without it, characters are assumed equally wide.
   */
  charX?: number[];
  /** Font size in points (for editing existing text). */
  fontPt?: number;
  family?: 'sans' | 'serif' | 'mono';
  bold?: boolean;
  italic?: boolean;
}

export type SensitiveKind = 'aadhaar' | 'aadhaar-mask' | 'pan' | 'phone' | 'email' | 'ifsc' | 'account' | 'custom';

export interface Match {
  kind: SensitiveKind;
  text: string;
  boxes: { u: number; v: number; w: number; h: number }[];
}

export const KIND_LABELS: Record<SensitiveKind, string> = {
  aadhaar: 'Aadhaar number',
  'aadhaar-mask': 'Aadhaar (first 8 digits)',
  pan: 'PAN',
  phone: 'Phone number',
  email: 'Email',
  ifsc: 'IFSC code',
  account: 'Account / long number',
  custom: 'Your search',
};

// ─── Verhoeff checksum (Aadhaar's last digit) ────────────────────────────────
const D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5], [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7], [4, 0, 1, 2, 3, 9, 5, 6, 7, 8], [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3], [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4], [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7], [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];
export function verhoeffValid(digits: string): boolean {
  let c = 0;
  const arr = digits.split('').reverse().map(Number);
  for (let i = 0; i < arr.length; i++) c = D[c][P[i % 8][arr[i]]];
  return c === 0;
}

/** Aadhaar: 12 digits, first digit 2-9, valid Verhoeff checksum. */
export function isAadhaar(raw: string): boolean {
  const d = raw.replace(/\D/g, '');
  return d.length === 12 && /^[2-9]/.test(d) && verhoeffValid(d);
}

const PATTERNS: { kind: Exclude<SensitiveKind, 'aadhaar-mask' | 'custom'>; re: RegExp; check?: (s: string) => boolean }[] = [
  { kind: 'aadhaar', re: /\b\d{4}[ -]?\d{4}[ -]?\d{4}\b/g, check: isAadhaar },
  { kind: 'pan', re: /\b[A-Z]{5}\d{4}[A-Z]\b/g },
  { kind: 'email', re: /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g },
  { kind: 'ifsc', re: /\b[A-Z]{4}0[A-Z0-9]{6}\b/g },
  { kind: 'phone', re: /(?:\+91[\s-]?|\b0)?\b[6-9]\d{4}[\s-]?\d{5}\b/g },
  { kind: 'account', re: /\b\d{9,18}\b/g },
];

/** Join runs into one string and remember where each character came from. */
function joinRuns(runs: TextRun[]) {
  let text = '';
  const map: { run: number; ch: number }[] = [];
  runs.forEach((r, i) => {
    if (i > 0) {
      text += ' ';
      map.push({ run: -1, ch: -1 });
    }
    for (let c = 0; c < r.str.length; c++) {
      text += r.str[c];
      map.push({ run: i, ch: c });
    }
  });
  return { text, map };
}

/** Boxes covering text[start, end) — partial runs are cut proportionally by character. */
function boxesFor(runs: TextRun[], map: { run: number; ch: number }[], start: number, end: number) {
  const byRun = new Map<number, { from: number; to: number }>();
  for (let i = start; i < end; i++) {
    const m = map[i];
    if (!m || m.run < 0) continue;
    const cur = byRun.get(m.run);
    if (!cur) byRun.set(m.run, { from: m.ch, to: m.ch + 1 });
    else cur.to = m.ch + 1;
  }
  return [...byRun.entries()].map(([ri, { from, to }]) => {
    const r = runs[ri];
    const n = Math.max(1, r.str.length);
    const x = (i: number) => (r.charX && r.charX.length === r.str.length + 1 ? r.charX[i] : i / n);
    // Generous margin: for redaction, covering a little too much is safe; too little leaks.
    const avg = r.w / n;
    const padX = avg * 0.45;
    const padY = r.h * 0.12;
    const left = r.u + x(from) * r.w - padX;
    const right = r.u + x(to) * r.w + padX;
    return { u: left, v: r.v - padY, w: right - left, h: r.h + padY * 2 };
  });
}

/**
 * Find sensitive values on one page. Each character is claimed by the first pattern that
 * matches it (so an Aadhaar number is not also reported as an account number).
 * `custom` searches for an exact phrase (case-insensitive).
 */
export function findSensitive(runs: TextRun[], opts: { kinds?: SensitiveKind[]; custom?: string } = {}): Match[] {
  const want = new Set(opts.kinds ?? ['aadhaar', 'pan', 'phone', 'email', 'ifsc', 'account']);
  const { text, map } = joinRuns(runs);
  const claimed = new Uint8Array(text.length);
  const out: Match[] = [];
  const claim = (s: number, e: number) => {
    for (let i = s; i < e; i++) if (claimed[i]) return false;
    claimed.fill(1, s, e);
    return true;
  };

  if (opts.custom?.trim()) {
    const needle = opts.custom.trim().toLowerCase();
    const hay = text.toLowerCase();
    for (let i = hay.indexOf(needle); i >= 0; i = hay.indexOf(needle, i + needle.length)) {
      out.push({ kind: 'custom', text: text.slice(i, i + needle.length), boxes: boxesFor(runs, map, i, i + needle.length) });
    }
  }

  for (const p of PATTERNS) {
    const wantMask = p.kind === 'aadhaar' && want.has('aadhaar-mask');
    if (!want.has(p.kind) && !wantMask) continue;
    for (const m of text.matchAll(p.re)) {
      const s = m.index!;
      const e = s + m[0].length;
      if (p.check && !p.check(m[0])) continue;
      if (!claim(s, e)) continue;
      if (wantMask) {
        // First 8 digits only, like UIDAI's masked Aadhaar (XXXX XXXX 1234).
        let digits = 0;
        let cut = s;
        while (cut < e && digits < 8) {
          if (/\d/.test(text[cut])) digits++;
          cut++;
        }
        out.push({ kind: 'aadhaar-mask', text: m[0], boxes: boxesFor(runs, map, s, cut) });
      }
      if (want.has(p.kind)) out.push({ kind: p.kind, text: m[0], boxes: boxesFor(runs, map, s, e) });
    }
  }
  return out;
}
