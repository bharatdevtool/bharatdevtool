// Fonts for text in the PDF editor. Light (no pdf-lib): safe to import from UI code.
//
// A font key is stored on each text object:
//   'sans' | 'serif' | 'mono'  → the standard PDF fonts (Helvetica, Times, Courier), never embedded
//   'web:<id>'                 → a free font hosted in public/fonts/pdf (see LICENSES.txt there)
//   'sys:<family>'             → a font installed on the user's computer (Chrome/Edge desktop)

export type StandardFamily = 'sans' | 'serif' | 'mono';
export type FontKey = string;

export interface WebFont {
  id: string;
  label: string;
  /** File names in /fonts/pdf/ (Latin subset). */
  regular: string;
  bold: string;
  /** Closest standard look, used if the file can't be loaded. */
  fallback: StandardFamily;
}

const file = (id: string, w: 400 | 700) => `${id}-latin-${w}-normal.woff`;
const web = (id: string, label: string, fallback: StandardFamily): WebFont => ({ id, label, regular: file(id, 400), bold: file(id, 700), fallback });

export const WEB_FONTS: WebFont[] = [
  web('roboto', 'Roboto', 'sans'),
  web('open-sans', 'Open Sans', 'sans'),
  web('lato', 'Lato', 'sans'),
  web('noto-sans', 'Noto Sans', 'sans'),
  web('poppins', 'Poppins', 'sans'),
  web('montserrat', 'Montserrat', 'sans'),
  web('merriweather', 'Merriweather', 'serif'),
  web('playfair-display', 'Playfair Display', 'serif'),
  web('courier-prime', 'Courier Prime', 'mono'),
  web('dancing-script', 'Dancing Script', 'sans'),
];

export const STANDARD_FONTS: { key: StandardFamily; label: string; css: string }[] = [
  { key: 'sans', label: 'Helvetica (Sans)', css: 'Helvetica, Arial, sans-serif' },
  { key: 'serif', label: 'Times (Serif)', css: '"Times New Roman", Times, serif' },
  { key: 'mono', label: 'Courier (Mono)', css: '"Courier New", Courier, monospace' },
];

export const webFontUrl = (name: string) => `/fonts/pdf/${name}`;
export const isStandardFont = (key: FontKey | undefined): key is StandardFamily => !key || key === 'sans' || key === 'serif' || key === 'mono';
export const webFontOf = (key: FontKey | undefined) => (key?.startsWith('web:') ? WEB_FONTS.find((f) => `web:${f.id}` === key) : undefined);
export const systemFamilyOf = (key: FontKey | undefined) => (key?.startsWith('sys:') ? key.slice(4) : undefined);

/** CSS font-family for a key, used on screen and when text has to be drawn as an image. */
export function fontCss(key: FontKey | undefined): string {
  if (isStandardFont(key)) return STANDARD_FONTS.find((f) => f.key === (key ?? 'sans'))!.css;
  const w = webFontOf(key);
  if (w) return `"BDT ${w.label}", ${STANDARD_FONTS.find((f) => f.key === w.fallback)!.css}`;
  const sys = systemFamilyOf(key);
  return sys ? `"${sys.replace(/"/g, '')}", Helvetica, Arial, sans-serif` : STANDARD_FONTS[0].css;
}

/** Short name for menus. */
export function fontLabel(key: FontKey | undefined): string {
  if (isStandardFont(key)) return STANDARD_FONTS.find((f) => f.key === (key ?? 'sans'))!.label;
  return webFontOf(key)?.label ?? systemFamilyOf(key) ?? 'Helvetica (Sans)';
}
