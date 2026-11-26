// src/lib/lottie/zipInspect.ts — Raw ZIP reader for .lottie archives.
//
// Zip libraries (fflate, JSZip) and browsers read the central directory at the end
// of the file, which always holds the real sizes. Android's lottie-android reads the
// archive front to back with java.util.zip.ZipInputStream, which only sees the local
// header in front of each entry. Figma writes STORED entries whose local header has
// zero sizes and a "data descriptor" flag, which ZipInputStream rejects with
// "only DEFLATED entries can have EXT descriptor". To see that, both headers have to
// be read from the raw bytes, which is what this module does. Pure functions, no DOM.

import { inflateSync } from 'fflate';

const SIG_LOCAL = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_EOCD = 0x06054b50;
const SIG_ZIP64_LOCATOR = 0x07064b50;
const EOCD_SIZE = 22;
const MAX_COMMENT = 0xffff;

/** General purpose flag bits */
export const FLAG_ENCRYPTED = 0x0001;
export const FLAG_DATA_DESCRIPTOR = 0x0008;
export const FLAG_UTF8 = 0x0800;

export const METHOD_STORED = 0;
export const METHOD_DEFLATE = 8;

export interface ZipHeaderInfo {
  flag: number;
  method: number;
  crc: number;
  compressedSize: number;
  size: number;
}

/**
 * - `android-breaking`: STORED + data descriptor. ZipInputStream throws, the file never loads on Android.
 * - `android-risky`: DEFLATE + data descriptor. Readable, but non-standard.
 * - `mismatch`: the local header has sizes/CRC that disagree with the central directory.
 * - `unsupported`: encrypted, ZIP64 or a compression method other than STORED/DEFLATE.
 */
export type ZipEntryStatus = 'ok' | 'android-breaking' | 'android-risky' | 'mismatch' | 'unsupported';

/** What the entry is: a real file, a folder entry, or OS junk (__MACOSX, .DS_Store). */
export type ZipEntryKind = 'file' | 'directory' | 'junk';

export interface ZipEntryInfo {
  name: string;
  central: ZipHeaderInfo;
  local: ZipHeaderInfo | null;
  localOffset: number;
  /** Offset of the compressed data, or -1 when the local header could not be read */
  dataOffset: number;
  status: ZipEntryStatus;
  kind: ZipEntryKind;
  /** Short human-readable reasons behind a non-ok status */
  notes: string[];
}

export interface ZipInspection {
  ok: boolean;
  /** Set when the archive can't be read at all (not a zip, truncated, ZIP64, …) */
  error?: string;
  zip64: boolean;
  entries: ZipEntryInfo[];
}

// ── CRC-32 ───────────────────────────────────────────────────────

let CRC_TABLE: Uint32Array | null = null;

function crcTable(): Uint32Array {
  if (CRC_TABLE) return CRC_TABLE;
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  CRC_TABLE = table;
  return table;
}

/** Standard CRC-32 (the one ZIP uses), as an unsigned 32-bit number. */
export function crc32(data: Uint8Array): number {
  const table = crcTable();
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

// ── Helpers ──────────────────────────────────────────────────────

/** True when the bytes start with a ZIP local file header ("PK\x03\x04"). */
export function looksLikeZip(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

export function isJunkName(name: string): boolean {
  const base = name.split('/').pop() || '';
  return name.startsWith('__MACOSX/') || name.includes('/__MACOSX/') || base === '.DS_Store' || base === 'Thumbs.db' || base.startsWith('._');
}

function decodeName(bytes: Uint8Array): string {
  // Non-UTF-8 names are CP437 by the spec; .lottie names are ASCII in practice, and
  // ZipInputStream decodes them as UTF-8 anyway, so do the same.
  return new TextDecoder('utf-8').decode(bytes);
}

function readHeader(view: DataView, at: number, local: boolean): ZipHeaderInfo {
  // Local: flag@6 method@8 crc@14 csize@18 usize@22 · Central: flag@8 method@10 crc@16 csize@20 usize@24
  const o = local ? 0 : 2;
  return {
    flag: view.getUint16(at + 6 + o, true),
    method: view.getUint16(at + 8 + o, true),
    crc: view.getUint32(at + 14 + o, true),
    compressedSize: view.getUint32(at + 18 + o, true),
    size: view.getUint32(at + 22 + o, true),
  };
}

function classify(entry: Omit<ZipEntryInfo, 'status' | 'notes'>): { status: ZipEntryStatus; notes: string[] } {
  const { central, local } = entry;
  const notes: string[] = [];
  const flag = local ? local.flag : central.flag;
  const method = local ? local.method : central.method;

  if (flag & FLAG_ENCRYPTED || central.flag & FLAG_ENCRYPTED) {
    return { status: 'unsupported', notes: ['Encrypted entry'] };
  }
  if (method !== METHOD_STORED && method !== METHOD_DEFLATE) {
    return { status: 'unsupported', notes: [`Unsupported compression method ${method}`] };
  }
  if (!local) return { status: 'mismatch', notes: ['Local header missing or unreadable'] };

  const descriptor = (local.flag & FLAG_DATA_DESCRIPTOR) !== 0;
  if (descriptor && method === METHOD_STORED) {
    notes.push('Uncompressed (STORED) entry with a data descriptor: Android cannot read it');
    return { status: 'android-breaking', notes };
  }
  if (local.method !== central.method) {
    return { status: 'mismatch', notes: ['Compression method differs between local and central headers'] };
  }
  // With a data descriptor the local values are allowed to be zero; anything non-zero must match.
  const differs = (a: number, b: number) => (descriptor ? a !== 0 && a !== b : a !== b);
  if (
    differs(local.crc, central.crc) ||
    differs(local.compressedSize, central.compressedSize) ||
    differs(local.size, central.size)
  ) {
    return { status: 'mismatch', notes: ['Local header sizes/CRC disagree with the central directory'] };
  }
  if (descriptor) {
    return { status: 'android-risky', notes: ['Sizes are written after the data (data descriptor) instead of in the header'] };
  }
  return { status: 'ok', notes };
}

// ── Inspection ───────────────────────────────────────────────────

/**
 * Read both the central directory and every local header of a ZIP archive.
 * Never throws: an unreadable archive comes back with `ok: false` and an `error`.
 */
export function inspectZip(bytes: Uint8Array): ZipInspection {
  const fail = (error: string, zip64 = false): ZipInspection => ({ ok: false, error, zip64, entries: [] });

  if (bytes.length < EOCD_SIZE) return fail('The file is too small to be a .lottie (zip) archive.');
  if (!looksLikeZip(bytes)) return fail('This is not a .lottie (zip) archive: it does not start with the zip signature "PK".');

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  // 1. End of Central Directory: scan backwards (a comment of up to 64 KB may follow it).
  let eocd = -1;
  const stop = Math.max(0, bytes.length - EOCD_SIZE - MAX_COMMENT);
  for (let i = bytes.length - EOCD_SIZE; i >= stop; i--) {
    if (view.getUint32(i, true) === SIG_EOCD) {
      const commentLength = view.getUint16(i + 20, true);
      if (i + EOCD_SIZE + commentLength <= bytes.length) {
        eocd = i;
        break;
      }
    }
  }
  if (eocd < 0) return fail('The zip index (end of central directory) is missing. The file is truncated or corrupt.');

  const entryCount = view.getUint16(eocd + 10, true);
  const cdSize = view.getUint32(eocd + 12, true);
  const cdOffset = view.getUint32(eocd + 16, true);
  const hasZip64Locator = eocd >= 20 && view.getUint32(eocd - 20, true) === SIG_ZIP64_LOCATOR;
  if (hasZip64Locator || entryCount === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) {
    return fail('This archive uses ZIP64, which Lottie players do not support. Re-export it as a normal .lottie.', true);
  }
  if (cdOffset + cdSize > eocd) return fail('The zip index points past the end of the file. The file is truncated or corrupt.');

  // 2. Central directory
  const entries: ZipEntryInfo[] = [];
  let p = cdOffset;
  for (let n = 0; n < entryCount; n++) {
    if (p + 46 > eocd || view.getUint32(p, true) !== SIG_CENTRAL) {
      return fail(`The zip index is damaged at entry ${n + 1} of ${entryCount}.`);
    }
    const central = readHeader(view, p, false);
    const nameLength = view.getUint16(p + 28, true);
    const extraLength = view.getUint16(p + 30, true);
    const commentLength = view.getUint16(p + 32, true);
    const localOffset = view.getUint32(p + 42, true);
    if (p + 46 + nameLength > eocd) return fail(`The zip index is damaged at entry ${n + 1} of ${entryCount}.`);
    const name = decodeName(bytes.subarray(p + 46, p + 46 + nameLength));
    p += 46 + nameLength + extraLength + commentLength;

    if (central.compressedSize === 0xffffffff || central.size === 0xffffffff || localOffset === 0xffffffff) {
      return fail('This archive uses ZIP64, which Lottie players do not support. Re-export it as a normal .lottie.', true);
    }

    // 3. Local header for this entry
    let local: ZipHeaderInfo | null = null;
    let dataOffset = -1;
    if (localOffset + 30 <= bytes.length && view.getUint32(localOffset, true) === SIG_LOCAL) {
      local = readHeader(view, localOffset, true);
      const localNameLength = view.getUint16(localOffset + 26, true);
      const localExtraLength = view.getUint16(localOffset + 28, true);
      dataOffset = localOffset + 30 + localNameLength + localExtraLength;
      if (dataOffset + central.compressedSize > bytes.length) {
        return fail(`"${name}" runs past the end of the file. The file is truncated.`);
      }
    }

    const kind: ZipEntryKind = isJunkName(name) ? 'junk' : name.endsWith('/') ? 'directory' : 'file';
    const base = { name, central, local, localOffset, dataOffset, kind };
    entries.push({ ...base, ...classify(base) });
  }

  return { ok: true, zip64: false, entries };
}

export interface EntryData {
  ok: boolean;
  data?: Uint8Array;
  error?: string;
}

/**
 * Decompress one entry using the central-directory sizes (never the zeroed local ones)
 * and check its CRC-32.
 */
export function readEntry(bytes: Uint8Array, entry: ZipEntryInfo): EntryData {
  if (entry.status === 'unsupported') return { ok: false, error: entry.notes[0] || 'Unsupported entry' };
  if (entry.dataOffset < 0) return { ok: false, error: `"${entry.name}" has no readable local header.` };
  const raw = bytes.subarray(entry.dataOffset, entry.dataOffset + entry.central.compressedSize);
  let data: Uint8Array;
  try {
    data =
      entry.central.size === 0
        ? new Uint8Array(0)
        : entry.central.method === METHOD_STORED
        ? raw.slice()
        : inflateSync(raw, { out: new Uint8Array(entry.central.size) });
  } catch {
    return { ok: false, error: `"${entry.name}" could not be decompressed. The file is corrupt.` };
  }
  if (data.length !== entry.central.size) {
    return { ok: false, error: `"${entry.name}" has the wrong size after decompression. The file is corrupt.` };
  }
  if (crc32(data) !== entry.central.crc) {
    return { ok: false, error: `"${entry.name}" failed its CRC check. The file is corrupt.` };
  }
  return { ok: true, data };
}

/** Entries that stop Android from opening the file, or that a repack should normalise. */
export function summarizeZip(inspection: ZipInspection) {
  const count = (s: ZipEntryStatus) => inspection.entries.filter((e) => e.status === s).length;
  return {
    androidBreaking: count('android-breaking'),
    androidRisky: count('android-risky'),
    mismatch: count('mismatch'),
    unsupported: count('unsupported'),
    junk: inspection.entries.filter((e) => e.kind === 'junk').length,
    directories: inspection.entries.filter((e) => e.kind === 'directory').length,
  };
}
