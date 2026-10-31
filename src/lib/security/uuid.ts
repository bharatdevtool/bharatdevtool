// lib/security/uuid.ts

export type UUIDVersion = 'v1' | 'v4' | 'v7';

/** Generate UUID v4 (random) */
function uuidV4(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return formatUUID(bytes);
}

/** Generate UUID v7 (time-ordered) */
function uuidV7(): string {
  const now = Date.now();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  // ms timestamp in first 48 bits
  const ts = BigInt(now);
  bytes[0] = Number((ts >> 40n) & 0xffn);
  bytes[1] = Number((ts >> 32n) & 0xffn);
  bytes[2] = Number((ts >> 24n) & 0xffn);
  bytes[3] = Number((ts >> 16n) & 0xffn);
  bytes[4] = Number((ts >> 8n) & 0xffn);
  bytes[5] = Number(ts & 0xffn);
  bytes[6] = (bytes[6] & 0x0f) | 0x70; // version 7
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return formatUUID(bytes);
}

/** UUID v1 approximation (time-based, no MAC address) */
function uuidV1(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const now = Date.now();
  const ts = BigInt(now) * 10000n + 122192928000000000n; // 100-ns intervals since Oct 1582
  bytes[0] = Number((ts >> 24n) & 0xffn);
  bytes[1] = Number((ts >> 16n) & 0xffn);
  bytes[2] = Number((ts >> 8n) & 0xffn);
  bytes[3] = Number(ts & 0xffn);
  bytes[4] = Number((ts >> 40n) & 0xffn);
  bytes[5] = Number((ts >> 32n) & 0xffn);
  bytes[6] = (Number((ts >> 56n) & 0x0fn)) | 0x10; // version 1
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return formatUUID(bytes);
}

function formatUUID(bytes: Uint8Array): string {
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function generateUUID(version: UUIDVersion): string {
  switch (version) {
    case 'v1': return uuidV1();
    case 'v7': return uuidV7();
    default:   return uuidV4();
  }
}

export function generateBulkUUIDs(version: UUIDVersion, count: number): string[] {
  return Array.from({ length: count }, () => generateUUID(version));
}

export function isValidUUID(uuid: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-7][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);
}

export function detectUUIDVersion(uuid: string): string | null {
  const match = uuid.match(/^[0-9a-f]{8}-[0-9a-f]{4}-([1-7])[0-9a-f]{3}-/i);
  return match ? `v${match[1]}` : null;
}

