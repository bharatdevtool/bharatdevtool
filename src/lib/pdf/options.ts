// Light PDF option helpers (no pdf-lib), safe to import from UI code that loads before the engine.
// protect.ts and stamp.ts re-export these.

// ─── Passwords ───────────────────────────────────────────────────────────────

export function passwordProblem(password: string, confirm: string): string | null {
  if (!password) return 'Enter a password.';
  if (password !== confirm) return 'The two passwords do not match.';
  return null;
}

/** Share-with-expiry date as shown on the cover, watermark and viewer (with the time zone, for recipients elsewhere). */
export const formatExpiry = (ms: number) =>
  new Date(ms).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });

/** The admin password must differ from the open password, or anyone who can open the file can lift the restrictions. */
export function ownerPasswordProblem(openPassword: string, ownerPassword: string): string | null {
  if (ownerPassword && ownerPassword === openPassword) return 'The admin password must be different from the open password.';
  return null;
}

export type PdfEncryption = 'AES-256' | 'AES-128';

/** What a reader may do after opening a protected PDF (honoured by most, not all, PDF readers). */
export interface PdfPermissions {
  print: boolean;
  /** Full-quality printing; when off, readers print a low-resolution copy. */
  printHighRes: boolean;
  copy: boolean;
  /** Change the page content. */
  modify: boolean;
  /** Add comments and highlights. */
  comment: boolean;
  fillForms: boolean;
  /** Insert, rotate or delete pages. */
  assemble: boolean;
}

export const ALL_PERMISSIONS: PdfPermissions = {
  print: true, printHighRes: true, copy: true, modify: true, comment: true, fillForms: true, assemble: true,
};

export const PERMISSION_LABELS: [keyof PdfPermissions, string][] = [
  ['print', 'Printing'],
  ['printHighRes', 'High-quality printing'],
  ['copy', 'Copying text and images'],
  ['modify', 'Editing the content'],
  ['comment', 'Comments and highlights'],
  ['fillForms', 'Filling in forms'],
  ['assemble', 'Insert, rotate or delete pages'],
];

/** Simple strength hint; never blocks. */
export function passwordStrength(password: string): 'weak' | 'ok' | 'strong' {
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  if (password.length < 8 || kinds < 2) return 'weak';
  if (password.length >= 12 && kinds >= 3) return 'strong';
  return 'ok';
}

// ─── Watermark ───────────────────────────────────────────────────────────────

export type WatermarkLayout = 'diagonal' | 'tiled' | 'center' | 'bottom' | 'top';

/** Fill {date} and {name} in preset texts. */
export function fillWatermarkTemplate(text: string, vars: { date?: string; name?: string; until?: string }): string {
  return text
    .replace(/\{date\}/g, vars.date ?? '')
    .replace(/\{name\}/g, vars.name ?? '')
    .replace(/\{until\}/g, vars.until ?? '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export const WATERMARK_PRESETS = [
  { id: 'kyc', label: 'For KYC only', text: 'For KYC purpose only - {date}' },
  { id: 'shared', label: 'Shared with…', text: 'Shared with {name} - valid till {until}' },
  { id: 'confidential', label: 'Confidential', text: 'CONFIDENTIAL' },
  { id: 'draft', label: 'Draft', text: 'DRAFT' },
  { id: 'copy', label: 'Copy', text: 'COPY' },
  { id: 'sample', label: 'Sample', text: 'SAMPLE' },
] as const;

// ─── Page numbers ────────────────────────────────────────────────────────────

export type NumberPosition = 'bottom-center' | 'bottom-right' | 'bottom-left' | 'top-center' | 'top-right' | 'top-left';
export type NumberFormat = 'n' | 'page-n' | 'page-n-of-total' | 'n-slash-total';

export interface PageNumberOptions {
  position: NumberPosition;
  format: NumberFormat;
  /** Number printed on the first numbered page. */
  start: number;
  /** Leave the first page (cover) without a number. */
  skipFirst: boolean;
  size: number;
  color: string;
  /** Distance from the page edge in points. */
  margin: number;
}

export const DEFAULT_PAGE_NUMBERS: PageNumberOptions = {
  position: 'bottom-center',
  format: 'page-n-of-total',
  start: 1,
  skipFirst: false,
  size: 10,
  color: '#333333',
  margin: 28,
};

export function formatPageNumber(format: NumberFormat, n: number, total: number): string {
  switch (format) {
    case 'n':
      return `${n}`;
    case 'page-n':
      return `Page ${n}`;
    case 'page-n-of-total':
      return `Page ${n} of ${total}`;
    case 'n-slash-total':
      return `${n} / ${total}`;
  }
}
