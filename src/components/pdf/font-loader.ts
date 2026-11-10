// Load fonts for the editor: free web fonts from /fonts/pdf (for display and embedding) and the
// fonts installed on the computer (Local Font Access API, Chrome/Edge desktop, asks permission).
// Font files never leave the browser.

import { WEB_FONTS, systemFamilyOf, webFontOf, webFontUrl, type FontKey } from '@/lib/pdf/fonts';

// ─── Web fonts ───────────────────────────────────────────────────────────────

const shown = new Set<string>();

/** Make a web font available to CSS (regular + bold) so text shows in it on screen. */
export function showWebFont(key: FontKey | undefined): void {
  const w = webFontOf(key);
  if (!w || shown.has(w.id) || typeof document === 'undefined' || !('fonts' in document)) return;
  shown.add(w.id);
  for (const [file, weight] of [[w.regular, '400'], [w.bold, '700']] as const) {
    const face = new FontFace(`BDT ${w.label}`, `url(${webFontUrl(file)}) format("woff")`, { weight });
    document.fonts.add(face);
    face.load().catch(() => shown.delete(w.id));
  }
}

const fetched = new Map<string, Promise<Uint8Array>>();
const fetchBytes = (url: string) => {
  let p = fetched.get(url);
  if (!p) {
    p = fetch(url).then(async (r) => {
      if (!r.ok) throw new Error('font not found');
      return new Uint8Array(await r.arrayBuffer());
    });
    p.catch(() => fetched.delete(url));
    fetched.set(url, p);
  }
  return p;
};

// ─── Fonts on this computer ──────────────────────────────────────────────────

interface LocalFontData {
  family: string;
  style: string;
  postscriptName: string;
  blob(): Promise<Blob>;
}
type LocalFontWindow = Window & { queryLocalFonts?: () => Promise<LocalFontData[]> };

let local: Map<string, { regular: LocalFontData; bold?: LocalFontData }> | null = null;

export const canListLocalFonts = () => typeof window !== 'undefined' && typeof (window as LocalFontWindow).queryLocalFonts === 'function';

/** Families installed on this computer (asks for permission the first time). */
export async function listLocalFonts(): Promise<string[]> {
  if (!local) {
    const all = await (window as LocalFontWindow).queryLocalFonts!();
    const byFamily = new Map<string, LocalFontData[]>();
    for (const f of all) byFamily.set(f.family, [...(byFamily.get(f.family) ?? []), f]);
    local = new Map();
    for (const [family, faces] of byFamily) {
      if (family.startsWith('.')) continue; // hidden system UI fonts
      const regular = faces.find((f) => /^(regular|normal|book|roman|medium)$/i.test(f.style)) ?? faces[0];
      const bold = faces.find((f) => /^bold$/i.test(f.style));
      local.set(family, { regular, bold });
    }
  }
  return [...local.keys()].sort((a, b) => a.localeCompare(b));
}

// ─── Bytes for embedding ─────────────────────────────────────────────────────

export interface FontBytes {
  regular: Uint8Array;
  bold?: Uint8Array;
}

/**
 * Font files for the custom fonts used, keyed by font key. A font that can't be read (or is a
 * font collection, which PDF can't embed directly) is left out: its text is then drawn as an image.
 */
export async function fontBytesFor(keys: Iterable<FontKey>, needBold: (key: FontKey) => boolean): Promise<Record<FontKey, FontBytes>> {
  const out: Record<FontKey, FontBytes> = {};
  for (const key of new Set(keys)) {
    try {
      const w = webFontOf(key);
      if (w) {
        out[key] = { regular: await fetchBytes(webFontUrl(w.regular)), bold: needBold(key) ? await fetchBytes(webFontUrl(w.bold)) : undefined };
        continue;
      }
      const family = systemFamilyOf(key);
      const faces = family && local?.get(family);
      if (!faces) continue;
      const read = async (f: LocalFontData) => new Uint8Array(await (await f.blob()).arrayBuffer());
      const regular = await read(faces.regular);
      if (isCollection(regular)) continue;
      const bold = needBold(key) && faces.bold ? await read(faces.bold) : undefined;
      out[key] = { regular, bold: bold && !isCollection(bold) ? bold : undefined };
    } catch {
      /* drawn as an image instead */
    }
  }
  return out;
}

/** TrueType/OpenType collections (.ttc, common for macOS system fonts) start with "ttcf". */
const isCollection = (b: Uint8Array) => b[0] === 0x74 && b[1] === 0x74 && b[2] === 0x63 && b[3] === 0x66;

export { WEB_FONTS };
