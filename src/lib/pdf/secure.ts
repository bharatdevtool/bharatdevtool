// Secure Share: an encrypted .bdtpdf file that only our viewer opens, with a sealed expiry time.
// Serverless, so this is SOFT protection: it stops normal viewing after the expiry; it cannot stop
// screenshots or someone who reverse-engineers the format. Uses Web Crypto (browser + Node 20).

const MAGIC = 'BDTSHARE1';
const PBKDF2_ITERATIONS = 310_000;

export interface ShareHeader {
  v: 1;
  /** Original file name, shown to the recipient. */
  name: string;
  createdAt: number;
  /** Epoch ms after which the viewer refuses to open it. */
  expiresAt: number;
  /** Optional recipient name, drawn as a watermark in the viewer. */
  recipient?: string;
  /** The viewer shows a Print button. Missing = no printing (files made before this option). */
  allowPrint?: boolean;
  /** Pages carry the recipient/expiry watermark. Missing = yes (files made before this option). */
  watermark?: boolean;
  kdf: 'pbkdf2' | 'none';
  salt: string;
  iv: string;
  /** Present only when no password is set (anyone with the file can open it until expiry). */
  key?: string;
}

const enc = new TextEncoder();
const dec = new TextDecoder();
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const subtle = () => globalThis.crypto.subtle;

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await subtle().importKey('raw', enc.encode(password) as BufferSource, 'PBKDF2', false, ['deriveKey']);
  return subtle().deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export class ShareError extends Error {
  constructor(public code: 'not-a-share' | 'needs-password' | 'wrong-password' | 'expired' | 'damaged', message: string) {
    super(message);
    this.name = 'ShareError';
  }
}

export async function createShare(
  pdf: Uint8Array,
  opts: { name: string; expiresAt: number; password?: string; recipient?: string; allowPrint?: boolean; watermark?: boolean; now?: number },
): Promise<Uint8Array> {
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  let key: CryptoKey;
  let rawKey: Uint8Array | undefined;
  if (opts.password) {
    key = await deriveKey(opts.password, salt);
  } else {
    rawKey = globalThis.crypto.getRandomValues(new Uint8Array(32));
    key = await subtle().importKey('raw', rawKey as BufferSource, 'AES-GCM', false, ['encrypt']);
  }
  const header: ShareHeader = {
    v: 1,
    name: opts.name,
    createdAt: opts.now ?? Date.now(),
    expiresAt: opts.expiresAt,
    ...(opts.recipient ? { recipient: opts.recipient } : {}),
    ...(opts.allowPrint ? { allowPrint: true } : {}),
    ...(opts.watermark === false ? { watermark: false } : {}),
    kdf: opts.password ? 'pbkdf2' : 'none',
    salt: b64(salt),
    iv: b64(iv),
    ...(rawKey ? { key: b64(rawKey) } : {}),
  };
  const headerBytes = enc.encode(JSON.stringify(header));
  // The header is authenticated: changing the expiry makes decryption fail.
  const cipher = new Uint8Array(
    await subtle().encrypt({ name: 'AES-GCM', iv: iv as BufferSource, additionalData: headerBytes as BufferSource }, key, pdf as BufferSource),
  );
  const prefix = enc.encode(`${MAGIC}\n`);
  const len = enc.encode(`${headerBytes.length}\n`);
  const out = new Uint8Array(prefix.length + len.length + headerBytes.length + cipher.length);
  out.set(prefix, 0);
  out.set(len, prefix.length);
  out.set(headerBytes, prefix.length + len.length);
  out.set(cipher, prefix.length + len.length + headerBytes.length);
  return out;
}

/** Read the header without decrypting (to show name/expiry and ask for a password). */
export function readShareHeader(file: Uint8Array): { header: ShareHeader; headerBytes: Uint8Array; cipher: Uint8Array } {
  const text = dec.decode(file.subarray(0, 64));
  if (!text.startsWith(`${MAGIC}\n`)) throw new ShareError('not-a-share', 'This is not a Bharat Dev Tools secure file.');
  const lenStart = MAGIC.length + 1;
  const nl = text.indexOf('\n', lenStart);
  const len = Number(text.slice(lenStart, nl));
  const start = enc.encode(text.slice(0, nl + 1)).length;
  if (!Number.isFinite(len) || len <= 0) throw new ShareError('damaged', 'This secure file is damaged.');
  const headerBytes = file.subarray(start, start + len);
  try {
    const header = JSON.parse(dec.decode(headerBytes)) as ShareHeader;
    return { header, headerBytes, cipher: file.subarray(start + len) };
  } catch {
    throw new ShareError('damaged', 'This secure file is damaged.');
  }
}

/**
 * Decrypt after checking expiry against `trustedNow` (pass the server time, not the device clock).
 */
export async function openShare(file: Uint8Array, trustedNow: number, password?: string): Promise<{ header: ShareHeader; pdf: Uint8Array }> {
  const { header, headerBytes, cipher } = readShareHeader(file);
  if (trustedNow > header.expiresAt) throw new ShareError('expired', 'This shared file has expired.');
  let key: CryptoKey;
  if (header.kdf === 'pbkdf2') {
    if (!password) throw new ShareError('needs-password', 'This file needs a password.');
    key = await deriveKey(password, unb64(header.salt));
  } else {
    if (!header.key) throw new ShareError('damaged', 'This secure file is damaged.');
    key = await subtle().importKey('raw', unb64(header.key) as BufferSource, 'AES-GCM', false, ['decrypt']);
  }
  try {
    const plain = await subtle().decrypt(
      { name: 'AES-GCM', iv: unb64(header.iv) as BufferSource, additionalData: headerBytes as BufferSource },
      key,
      cipher as BufferSource,
    );
    return { header, pdf: new Uint8Array(plain) };
  } catch {
    throw header.kdf === 'pbkdf2'
      ? new ShareError('wrong-password', 'That password is not right (or the file was changed).')
      : new ShareError('damaged', 'This secure file is damaged or was changed.');
  }
}

/** Text of the viewer watermark ('' when the sender turned it off). `until` is the formatted expiry. */
export function shareWatermarkText(header: Pick<ShareHeader, 'recipient' | 'watermark'>, until: string): string {
  if (header.watermark === false) return '';
  return `${header.recipient ? `Shared with ${header.recipient} · ` : ''}until ${until}`;
}

/** Quick check for the raw .bdtpdf container. */
export function isRawShare(file: Uint8Array): boolean {
  return dec.decode(file.subarray(0, MAGIC.length)) === MAGIC;
}
