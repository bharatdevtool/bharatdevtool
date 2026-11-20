// tests/helpers/figmaZip.ts — Builds ZIP archives byte by byte, including the
// "Figma style" that breaks Android: every entry has general purpose flag 0x0808
// (bit 3 data descriptor + bit 11 UTF-8), zero CRC/sizes in the local header, the
// real values in a data descriptor after the data, STORED for images/manifest and
// DEFLATE for the animation JSON. Used by tests and to generate the demo sample.

import { deflateSync } from 'fflate';

export interface RawEntry {
  name: string;
  data: Uint8Array;
  /** 0 = STORED, 8 = DEFLATE (default: 8 for .json except manifest.json, else 0) */
  method?: number;
  /** Override the general purpose flag (default 0x0808 when `descriptor`, else 0) */
  flag?: number;
  /** Override what the local header claims (for mismatch tests) */
  localOverride?: Partial<{ crc: number; compressedSize: number; size: number }>;
}

export interface BuildOptions {
  /** Write sizes after the data with a data descriptor (Figma). Default true. */
  descriptor?: boolean;
  /** Pretend the archive is ZIP64 (entry count 0xFFFF in the EOCD) */
  zip64?: boolean;
}

let TABLE: Uint32Array | null = null;
function crc32(data: Uint8Array): number {
  if (!TABLE) {
    TABLE = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      TABLE[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function defaultMethod(name: string): number {
  return /\.json$/i.test(name) && name !== 'manifest.json' ? 8 : 0;
}

export function buildZip(entries: RawEntry[], options: BuildOptions = {}): Uint8Array {
  const descriptor = options.descriptor ?? true;
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  const push = (b: Uint8Array) => {
    chunks.push(b);
    offset += b.length;
  };

  for (const e of entries) {
    const name = enc.encode(e.name);
    const method = e.method ?? defaultMethod(e.name);
    const flag = e.flag ?? (descriptor ? 0x0808 : 0);
    const isDir = e.name.endsWith('/');
    const body = isDir ? new Uint8Array(0) : method === 8 ? deflateSync(e.data, { level: 6 }) : e.data;
    const crc = crc32(e.data);
    const usesDescriptor = (flag & 0x08) !== 0;

    const localOffset = offset;
    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, flag, true);
    lv.setUint16(8, method, true);
    lv.setUint16(10, 0, true);
    lv.setUint16(12, 0x21, true); // 1980-01-01
    lv.setUint32(14, e.localOverride?.crc ?? (usesDescriptor ? 0 : crc), true);
    lv.setUint32(18, e.localOverride?.compressedSize ?? (usesDescriptor ? 0 : body.length), true);
    lv.setUint32(22, e.localOverride?.size ?? (usesDescriptor ? 0 : e.data.length), true);
    lv.setUint16(26, name.length, true);
    lv.setUint16(28, 0, true);
    local.set(name, 30);
    push(local);
    push(body);
    if (usesDescriptor) {
      const dd = new Uint8Array(16);
      const dv = new DataView(dd.buffer);
      dv.setUint32(0, 0x08074b50, true);
      dv.setUint32(4, crc, true);
      dv.setUint32(8, body.length, true);
      dv.setUint32(12, e.data.length, true);
      push(dd);
    }

    const c = new Uint8Array(46 + name.length);
    const cv = new DataView(c.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, flag, true);
    cv.setUint16(10, method, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0x21, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, body.length, true);
    cv.setUint32(24, e.data.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, localOffset, true);
    c.set(name, 46);
    central.push(c);
  }

  const cdOffset = offset;
  for (const c of central) push(c);
  const cdSize = offset - cdOffset;

  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, options.zip64 ? 0xffff : entries.length, true);
  ev.setUint16(10, options.zip64 ? 0xffff : entries.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, cdOffset, true);
  push(eocd);

  const out = new Uint8Array(offset);
  let p = 0;
  for (const ch of chunks) {
    out.set(ch, p);
    p += ch.length;
  }
  return out;
}

/** A .lottie exactly as Figma writes it: manifest, animation and images, all with flag 0x0808. */
export function buildFigmaLottie(animationJson: Uint8Array, images: { name: string; data: Uint8Array }[] = []): Uint8Array {
  const manifest = new TextEncoder().encode(
    JSON.stringify({ version: '1.0', generator: 'Figma', animations: [{ id: 'animation' }] })
  );
  return buildZip([
    { name: 'manifest.json', data: manifest },
    { name: 'animations/animation.json', data: animationJson },
    ...images.map((i) => ({ name: `images/${i.name}`, data: i.data })),
  ]);
}
