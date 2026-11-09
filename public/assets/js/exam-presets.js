// exam-presets.js — photo/signature upload limits for common Indian exam forms.
//
// SOURCE OF TRUTH for resize-image-to-kb.html (dropdowns + the visible table).
// Figures were collected from 2026 notices as reported by coaching/guide sites;
// where sources disagreed we use the range that satisfies all of them.
// Always tell users to confirm against the official notice for their cycle.

export const PRESETS_LAST_CHECKED = '2026-11-09';

/**
 * @typedef {{
 *   id: string, label: string, minKB: number, maxKB: number,
 *   width?: number, height?: number,
 *   fit: 'cover' | 'contain' | 'none',
 *   note?: string
 * }} DocPreset
 * @typedef {{
 *   id: string, label: string, exams: string, officialUrl?: string,
 *   note?: string, docs: DocPreset[]
 * }} ExamGroup
 */

/** @type {ExamGroup[]} */
export const EXAM_GROUPS = [
  {
    id: 'banking',
    label: 'Bank exams (IBPS, SBI)',
    exams: 'IBPS PO, Clerk, RRB, SO · SBI PO, Clerk',
    officialUrl: 'https://www.ibps.in',
    docs: [
      { id: 'photo', label: 'Photograph', minKB: 20, maxKB: 50, width: 200, height: 230, fit: 'cover' },
      { id: 'signature', label: 'Signature', minKB: 10, maxKB: 20, width: 140, height: 60, fit: 'contain' },
      { id: 'thumb', label: 'Left thumb impression', minKB: 20, maxKB: 50, width: 240, height: 240, fit: 'contain' },
      { id: 'declaration', label: 'Handwritten declaration', minKB: 50, maxKB: 100, width: 800, height: 400, fit: 'contain' },
    ],
  },
  {
    id: 'neet',
    label: 'NEET UG',
    exams: 'NTA NEET (UG)',
    officialUrl: 'https://neet.nta.nic.in',
    docs: [
      { id: 'photo', label: 'Passport-size photo', minKB: 10, maxKB: 200, fit: 'none' },
      { id: 'postcard', label: 'Postcard-size photo (4×6 in)', minKB: 10, maxKB: 200, width: 800, height: 1200, fit: 'cover' },
      { id: 'signature', label: 'Signature', minKB: 10, maxKB: 30, fit: 'none', note: 'Sources range from 4–30 to 10–100 KB; 10–30 KB satisfies all.' },
    ],
  },
  {
    id: 'jee',
    label: 'JEE Main',
    exams: 'NTA JEE Main',
    officialUrl: 'https://jeemain.nta.nic.in',
    docs: [
      { id: 'photo', label: 'Photograph', minKB: 10, maxKB: 200, fit: 'none' },
      { id: 'signature', label: 'Signature', minKB: 10, maxKB: 50, fit: 'none', note: 'Some sources say up to 100 KB; 10–50 KB satisfies both.' },
    ],
  },
  {
    id: 'cuet',
    label: 'CUET UG',
    exams: 'NTA CUET (UG)',
    officialUrl: 'https://cuet.nta.nic.in',
    docs: [
      { id: 'photo', label: 'Photograph', minKB: 10, maxKB: 200, fit: 'none' },
      { id: 'signature', label: 'Signature', minKB: 10, maxKB: 50, fit: 'none' },
    ],
  },
  {
    id: 'ssc',
    label: 'SSC (CGL, CHSL)',
    exams: 'SSC CGL, CHSL and other SSC exams',
    officialUrl: 'https://ssc.gov.in',
    note: 'The photo is captured live with your webcam during the application; only the signature is uploaded.',
    docs: [{ id: 'signature', label: 'Signature', minKB: 10, maxKB: 20, fit: 'none' }],
  },
  {
    id: 'upsc',
    label: 'UPSC',
    exams: 'UPSC Civil Services and other UPSC exams',
    officialUrl: 'https://upsconline.nic.in',
    note: 'UPSC also captures a live photo, which must match the uploaded one. The signature image holds three signatures.',
    docs: [
      { id: 'photo', label: 'Photograph', minKB: 20, maxKB: 200, fit: 'none' },
      { id: 'signature', label: 'Signature (3 signatures in one image)', minKB: 20, maxKB: 100, fit: 'none' },
    ],
  },
  {
    id: 'rrb',
    label: 'Railways (RRB)',
    exams: 'RRB NTPC and other RRB exams',
    officialUrl: 'https://www.rrbapply.gov.in',
    note: 'The photo is captured live; only the signature is uploaded. Sources conflict on the size, so check your notice.',
    docs: [{ id: 'signature', label: 'Signature', minKB: 30, maxKB: 49, fit: 'none' }],
  },
  {
    id: 'size',
    label: 'Any form: exact size',
    exams: 'Any website or form with a file-size limit',
    docs: [
      { id: '20kb', label: 'Under 20 KB', minKB: 0, maxKB: 20, fit: 'none' },
      { id: '50kb', label: 'Under 50 KB', minKB: 0, maxKB: 50, fit: 'none' },
      { id: '100kb', label: 'Under 100 KB', minKB: 0, maxKB: 100, fit: 'none' },
      { id: '200kb', label: 'Under 200 KB', minKB: 0, maxKB: 200, fit: 'none' },
    ],
  },
];

/** @param {string} id */
export function getGroup(id) {
  return EXAM_GROUPS.find((g) => g.id === id);
}

/**
 * Guess which document an image is from its shape, so a batch of
 * photo + signature + thumb + declaration gets sorted automatically.
 * @param {ExamGroup} group
 * @param {number} width
 * @param {number} height
 * @returns {string} doc id within the group
 */
export function guessDoc(group, width, height) {
  const ids = group.docs.map((d) => d.id);
  const ratio = width / height;
  if (ratio >= 1.4) {
    // Wide: signature, or the larger declaration when the group has one.
    if (ids.includes('declaration') && ratio < 2.3 && width >= 600) return 'declaration';
    if (ids.includes('signature')) return 'signature';
  }
  if (ratio > 0.9 && ratio < 1.1 && ids.includes('thumb')) return 'thumb';
  if (ids.includes('photo')) return 'photo';
  return ids[0];
}
