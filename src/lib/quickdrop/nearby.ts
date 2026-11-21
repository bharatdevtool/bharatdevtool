// Nearby discovery without a server of our own: devices behind the same router share a public
// IPv4 address (and an IPv6 /64 prefix). A STUN request tells each browser that address; its hash
// names a lobby on the PeerJS pairing service, so every device on the same Wi-Fi meets in it.
// Only hashes leave the browser, never the address itself (PeerJS sees the IP anyway).

export const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/** The public address in an ICE candidate line, or null unless it is a server-reflexive (srflx) one. */
export function srflxAddress(candidate: string): string | null {
  const parts = candidate.trim().split(/\s+/);
  const typ = parts.indexOf('typ');
  if (typ < 0 || parts[typ + 1] !== 'srflx' || parts.length < 5) return null;
  const addr = parts[4].replace(/^\[|\]$/g, '');
  return IPV4.test(addr) || addr.includes(':') ? addr : null;
}

/** The first four groups of an IPv6 address ("2401:4900:1c2a:5f00"), or null if it is not one. */
export function ipv6Prefix64(addr: string): string | null {
  const a = addr.toLowerCase().split('%')[0];
  if (!/^[0-9a-f:]+$/.test(a) || !a.includes(':')) return null;
  const halves = a.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - head.length - tail.length;
  if (missing < 0 || (halves.length === 1 && missing !== 0)) return null;
  const groups = [...head, ...Array(missing).fill('0'), ...tail];
  if (groups.some((g) => g.length === 0 || g.length > 4)) return null;
  return groups.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, '')).join(':');
}

export interface NetworkKeys {
  /** Lobby key: the public IPv4 address, or the IPv6 /64 prefix when there is no IPv4. */
  lobby: string | null;
  /** IPv6 /64 prefix, used to hide strangers who share a carrier's IPv4 (CGNAT). */
  v6: string | null;
}

export function networkKeys(addresses: string[]): NetworkKeys {
  const v4 = addresses.find((a) => IPV4.test(a)) ?? null;
  const v6 = addresses.map(ipv6Prefix64).find((p): p is string => !!p) ?? null;
  return { lobby: v4 ? `v4:${v4}` : v6 ? `v6:${v6}` : null, v6 };
}

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** PeerJS ID of the lobby for a network key. */
export async function lobbyPeerId(key: string): Promise<string> {
  return `bdt-qd-lan-${(await sha256Hex(`bharatdevtool-quickdrop|${key}`)).slice(0, 24)}`;
}

/** Short tag of an IPv6 prefix that other devices can compare without learning the prefix. */
export async function networkTag(prefix: string): Promise<string> {
  return (await sha256Hex(`bharatdevtool-quickdrop-v6|${prefix}`)).slice(0, 12);
}

/** Ask the STUN servers for this device's public addresses (browser only). */
export async function publicAddresses(iceServers: RTCIceServer[] = ICE_SERVERS, timeoutMs = 4000): Promise<string[]> {
  if (typeof RTCPeerConnection === 'undefined') return [];
  const found = new Set<string>();
  let pc: RTCPeerConnection | null = null;
  try {
    pc = new RTCPeerConnection({ iceServers });
    const conn = pc;
    conn.createDataChannel('probe');
    await new Promise<void>((resolve) => {
      let settle: ReturnType<typeof setTimeout> | null = null;
      const done = setTimeout(resolve, timeoutMs);
      const finish = () => {
        clearTimeout(done);
        if (settle) clearTimeout(settle);
        resolve();
      };
      conn.onicecandidate = (e) => {
        if (!e.candidate) return finish();
        const addr = srflxAddress(e.candidate.candidate);
        if (!addr) return;
        found.add(addr);
        // Got an IPv4 answer: give IPv6 a moment to arrive, then stop.
        if (IPV4.test(addr) && !settle) settle = setTimeout(finish, 400);
      };
      conn.createOffer().then((o) => conn.setLocalDescription(o)).catch(finish);
    });
  } catch {
    // WebRTC blocked (privacy settings): nearby discovery is unavailable, PIN pairing still works.
  } finally {
    pc?.close();
  }
  return [...found];
}
