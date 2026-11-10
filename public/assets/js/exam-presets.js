// exam-presets.js — photo/signature upload limits for common Indian exam forms.
//
// SOURCE OF TRUTH for the Resize Image to KB pages (dropdowns, the visible table,
// the per-exam landing pages and the "will it be accepted?" checks).
//
// Published guides often disagree (e.g. one says 20–200 KB, another 20–300 KB).
// We use the SAFE RANGE: the overlap that passes under every version we found,
// and say so in `note`. Always tell users to confirm against the official notice.

export const PRESETS_LAST_CHECKED = '2026-11-10';

/**
 * @typedef {'photo' | 'signature' | 'thumb' | 'document'} DocKind
 * @typedef {{
 *   id: string, label: string, kind: DocKind, minKB: number, maxKB: number,
 *   width?: number, height?: number,
 *   fit: 'cover' | 'contain' | 'none',
 *   cm?: [number, number],
 *   aspect?: number,
 *   stamp?: 'required' | 'recommended',
 *   note?: string
 * }} DocPreset
 * `width`/`height`: exact pixels the portal checks. `cm`: printed size from the notice (shown to users).
 * `aspect`: width/height the photo must have when no exact pixels are given (we crop to it).
 * `stamp`: name and date under the photo.
 * @typedef {{
 *   id: string, label: string, short: string, exams: string, officialUrl?: string,
 *   note?: string, docs: DocPreset[]
 * }} ExamGroup
 */

/** @type {ExamGroup[]} */
export const EXAM_GROUPS = [
  {
    id: 'banking',
    label: 'Bank exams (IBPS, SBI)',
    short: 'IBPS & SBI',
    exams: 'IBPS PO, Clerk, RRB, SO · SBI PO, Clerk',
    officialUrl: 'https://www.ibps.in',
    docs: [
      { id: 'photo', label: 'Photograph', kind: 'photo', minKB: 20, maxKB: 50, width: 200, height: 230, fit: 'cover' },
      { id: 'signature', label: 'Signature', kind: 'signature', minKB: 10, maxKB: 20, width: 140, height: 60, fit: 'contain' },
      { id: 'thumb', label: 'Left thumb impression', kind: 'thumb', minKB: 20, maxKB: 50, width: 240, height: 240, fit: 'contain', note: 'A few guides list 10–20 KB; most give 20–50 KB.' },
      { id: 'declaration', label: 'Handwritten declaration', kind: 'document', minKB: 50, maxKB: 100, width: 800, height: 400, fit: 'contain' },
    ],
  },
  {
    id: 'upsc',
    label: 'UPSC (CSE, NDA, CDS…)',
    short: 'UPSC',
    exams: 'UPSC Civil Services, NDA, CDS and other UPSC exams',
    officialUrl: 'https://upsconline.nic.in',
    note: 'UPSC also captures a live photo, which must match the uploaded one. The signature image holds three signatures.',
    docs: [
      { id: 'photo', label: 'Photograph', kind: 'photo', minKB: 20, maxKB: 200, fit: 'none', stamp: 'recommended', note: 'Guides give 20–200 or 20–300 KB; 20–200 KB passes both. Many ask for your name and the photo date at the bottom.' },
      { id: 'signature', label: 'Signature (3 signatures in one image)', kind: 'signature', minKB: 20, maxKB: 100, fit: 'none' },
    ],
  },
  {
    id: 'ssc',
    label: 'SSC (CGL, CHSL, MTS, GD…)',
    short: 'SSC',
    exams: 'SSC CGL, CHSL, MTS, GD, CPO and other SSC exams',
    officialUrl: 'https://ssc.gov.in',
    note: 'The photo is captured live with your webcam during the application; only the signature is uploaded.',
    docs: [
      { id: 'signature', label: 'Signature', kind: 'signature', minKB: 10, maxKB: 20, cm: [6, 2], aspect: 3, fit: 'none', note: 'Most guides give 6 × 2 cm; a few say 4 × 2 cm.' },
    ],
  },
  {
    id: 'neet',
    label: 'NEET UG',
    short: 'NEET',
    exams: 'NTA NEET (UG)',
    officialUrl: 'https://neet.nta.nic.in',
    docs: [
      { id: 'photo', label: 'Passport-size photo', kind: 'photo', minKB: 10, maxKB: 200, cm: [3.5, 4.5], aspect: 3.5 / 4.5, fit: 'none' },
      { id: 'postcard', label: 'Postcard-size photo (4×6 in)', kind: 'photo', minKB: 10, maxKB: 200, width: 800, height: 1200, fit: 'cover' },
      { id: 'signature', label: 'Signature', kind: 'signature', minKB: 10, maxKB: 30, fit: 'none', note: 'Guides give 4–30 or 10–100 KB; 10–30 KB passes both.' },
      { id: 'thumb', label: 'Left thumb impression', kind: 'thumb', minKB: 50, maxKB: 200, fit: 'none', note: 'Guides give 10–200 or 50–300 KB; 50–200 KB passes both.' },
      { id: 'thumb-right', label: 'Right thumb impression', kind: 'thumb', minKB: 50, maxKB: 200, fit: 'none' },
    ],
  },
  {
    id: 'jee',
    label: 'JEE Main',
    short: 'JEE Main',
    exams: 'NTA JEE Main',
    officialUrl: 'https://jeemain.nta.nic.in',
    docs: [
      { id: 'photo', label: 'Photograph', kind: 'photo', minKB: 10, maxKB: 200, cm: [3.5, 4.5], aspect: 3.5 / 4.5, fit: 'none' },
      { id: 'signature', label: 'Signature', kind: 'signature', minKB: 10, maxKB: 50, fit: 'none', note: 'Some guides say up to 100 KB; 10–50 KB passes both.' },
    ],
  },
  {
    id: 'cuet',
    label: 'CUET (UG, PG)',
    short: 'CUET',
    exams: 'NTA CUET (UG) and CUET (PG)',
    officialUrl: 'https://cuet.nta.nic.in',
    docs: [
      { id: 'photo', label: 'Photograph', kind: 'photo', minKB: 10, maxKB: 200, cm: [3.5, 4.5], aspect: 3.5 / 4.5, fit: 'none' },
      { id: 'signature', label: 'Signature', kind: 'signature', minKB: 10, maxKB: 50, fit: 'none' },
    ],
  },
  {
    id: 'ctet',
    label: 'CTET',
    short: 'CTET',
    exams: 'CBSE CTET',
    officialUrl: 'https://ctet.nic.in',
    docs: [
      { id: 'photo', label: 'Photograph', kind: 'photo', minKB: 10, maxKB: 100, cm: [3.5, 4.5], aspect: 3.5 / 4.5, fit: 'none' },
      { id: 'signature', label: 'Signature', kind: 'signature', minKB: 10, maxKB: 30, cm: [3.5, 1.5], aspect: 3.5 / 1.5, fit: 'none', note: 'Guides give 3–30 or 10–100 KB; 10–30 KB passes both.' },
    ],
  },
  {
    id: 'rrb',
    label: 'Railways (RRB)',
    short: 'RRB',
    exams: 'RRB NTPC, Group D, ALP and other RRB exams',
    officialUrl: 'https://www.rrbapply.gov.in',
    note: 'The photo is captured live; only the signature is uploaded. Sources conflict on the size, so check your notice.',
    docs: [{ id: 'signature', label: 'Signature', kind: 'signature', minKB: 30, maxKB: 49, fit: 'none' }],
  },
  {
    id: 'size',
    label: 'Any form: exact size',
    short: 'Any form',
    exams: 'Any website or form with a file-size limit',
    docs: [10, 20, 30, 50, 100, 200, 500].map((kb) => ({
      id: `${kb}kb`, label: `Under ${kb} KB`, kind: /** @type {DocKind} */ ('photo'), minKB: 0, maxKB: kb, fit: /** @type {const} */ ('none'),
    })),
  },
];

/** @param {string} id */
export function getGroup(id) {
  return EXAM_GROUPS.find((g) => g.id === id);
}

/**
 * Guess which document an image is from its shape (and, when known, how many lines of
 * writing it has), so a batch of photo + signature + thumb + declaration gets sorted.
 * A phone photo of a signature is as wide as a declaration; the declaration has several lines.
 * @param {ExamGroup} group
 * @param {number} width
 * @param {number} height
 * @param {number} [lines] lines of writing, from inkLines()
 * @returns {string} doc id within the group
 */
export function guessDoc(group, width, height, lines) {
  const ids = group.docs.map((d) => d.id);
  const ratio = width / height;
  if (ratio >= 1.4) {
    // Wide: signature, or the larger declaration when the group has one.
    const written = lines === undefined || lines >= 3;
    if (ids.includes('declaration') && ratio < 2.3 && width >= 600 && written) return 'declaration';
    if (ids.includes('signature')) return 'signature';
  }
  if (ratio > 0.9 && ratio < 1.1 && ids.includes('thumb')) return 'thumb';
  if (ids.includes('photo')) return 'photo';
  return ids[0];
}

/** "20–50 KB" or "under 50 KB". @param {{ minKB: number, maxKB: number }} d */
export function rangeText(d) {
  return d.minKB > 0 ? `${d.minKB}–${d.maxKB} KB` : `under ${d.maxKB} KB`;
}

/** "200 × 230 px", "3.5 × 4.5 cm" or "". @param {DocPreset} d */
export function dimsText(d) {
  if (d.width && d.height) return `${d.width} × ${d.height} px`;
  if (d.cm) return `${d.cm[0]} × ${d.cm[1]} cm`;
  return '';
}

/**
 * Count separate horizontal lines of writing: rows with ink, split by empty rows.
 * A signature is one band; a handwritten declaration is several lines.
 * @param {Uint8ClampedArray} data RGBA pixels of a small copy of the image
 * @param {number} width
 * @param {number} height
 */
export function inkLines(data, width, height) {
  const n = width * height;
  if (!n) return 0;
  const lum = new Uint8Array(n);
  const hist = new Uint32Array(256);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    lum[i] = Math.round(0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2]);
    hist[lum[i]]++;
  }
  let acc = 0;
  let paper = 255;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc >= n / 2) { paper = v; break; }
  }
  const minInk = Math.max(2, Math.round(width * 0.02));
  let lines = 0;
  let run = 0;
  let gap = 2;
  for (let y = 0; y < height; y++) {
    let dark = 0;
    for (let x = 0; x < width; x++) if (lum[y * width + x] < paper - 50) dark++;
    if (dark >= minInk) {
      if (gap >= 2 && run === 0) lines++;
      run++;
      gap = 0;
    } else {
      gap++;
      if (gap >= 2) run = 0;
    }
  }
  return lines;
}
