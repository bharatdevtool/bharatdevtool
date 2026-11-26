// Nearby-device lobby on the PeerJS pairing service, with no server of our own.
//
// Every device on the same network computes the same lobby ID (see nearby.ts). The first one to
// register that ID becomes the lobby HOST; the others get `unavailable-id` and connect to it as
// MEMBERS. The host keeps the member list and sends it to everyone. When the host leaves, its
// links close and the members race to register the ID again: one wins and the rest rejoin.
// Lobby links carry only device names and IDs; files travel on separate device-to-device links.

import type { DeviceInfo } from './types';

type Listener = (arg: never) => void;

/** The parts of a PeerJS DataConnection the lobby uses. */
export interface LobbyConn {
  peer: string;
  open: boolean;
  on(event: string, cb: Listener): unknown;
  send(data: unknown): void;
  close(): void;
}

/** The parts of a PeerJS Peer the lobby uses. */
export interface LobbyPeer {
  destroyed: boolean;
  on(event: string, cb: Listener): unknown;
  connect(id: string, options?: { reliable?: boolean }): LobbyConn | undefined;
  reconnect(): void;
  destroy(): void;
}

/** A device in the lobby. `net` is a hashed IPv6 prefix, used to hide strangers on shared IPv4. */
export type LobbyMember = DeviceInfo & { net?: string };

type LobbyMessage = { type: 'LOBBY_HELLO'; member: unknown } | { type: 'LOBBY_LIST'; members: unknown[] };

export const MAX_MEMBERS = 24;
const DEVICE_TYPES = ['mobile', 'tablet', 'desktop'];

/** Device details from another device, trimmed to safe lengths. */
export function cleanMember(raw: unknown): LobbyMember | null {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Partial<LobbyMember>;
  if (typeof d.id !== 'string' || !/^[\w-]{1,64}$/.test(d.id)) return null;
  const member: LobbyMember = {
    id: d.id,
    name: String(d.name || 'Device').slice(0, 40),
    type: (DEVICE_TYPES.includes(d.type as string) ? d.type : 'desktop') as DeviceInfo['type'],
    os: String(d.os || '').slice(0, 20),
    browser: String(d.browser || '').slice(0, 20),
  };
  if (typeof d.net === 'string' && /^[0-9a-f]{1,16}$/.test(d.net)) member.net = d.net;
  return member;
}

/** Members worth showing: strangers whose IPv6 network differs from ours are left out. */
export function visibleMembers(members: LobbyMember[], ownNet: string | undefined, limit = 8): LobbyMember[] {
  const same = members.filter((m) => !ownNet || !m.net || m.net === ownNet);
  // Devices that share our IPv6 network are surely on our Wi-Fi: list them first.
  same.sort((a, b) => Number(!!ownNet && b.net === ownNet) - Number(!!ownNet && a.net === ownNet));
  return same.slice(0, limit);
}

export interface LobbyOptions {
  /** The lobby's PeerJS ID. */
  id: string;
  /** This device's own peer (already registered). Members link to the host through it. */
  mainPeer: LobbyPeer;
  /** Registers a new peer with the given ID (to try to become the host). */
  createPeer: (id: string) => LobbyPeer;
  /** This device as the others should see it; `id` is its main peer ID. */
  self: () => LobbyMember;
  /** Everyone else in the lobby, after every change. */
  onMembers: (members: LobbyMember[]) => void;
  random?: () => number;
  maxAttempts?: number;
}

export class Lobby {
  private host: LobbyPeer | null = null;
  private readonly members = new Map<LobbyConn, LobbyMember>();
  private link: LobbyConn | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private attempts = 0;
  private stopped = false;

  constructor(private readonly o: LobbyOptions) {}

  get role(): 'host' | 'member' | 'idle' {
    return this.host ? 'host' : this.link ? 'member' : 'idle';
  }

  start(): void {
    this.claim();
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const host = this.host;
    const link = this.link;
    this.host = null;
    this.link = null;
    this.members.clear();
    host?.destroy();
    link?.close();
  }

  /** The main peer reported `peer-unavailable` for the lobby ID: its host has just left. */
  hostUnavailable(): void {
    if (this.link) this.dropLink();
  }

  /** This device's details changed (for example its name): tell the others. */
  update(): void {
    if (this.host) this.broadcast();
    else if (this.link?.open) this.link.send({ type: 'LOBBY_HELLO', member: this.o.self() });
  }

  private claim(): void {
    if (this.stopped) return;
    const peer = this.o.createPeer(this.o.id);
    this.host = peer;
    peer.on('open', () => {
      if (this.host !== peer) return;
      this.attempts = 0;
      this.broadcast();
    });
    peer.on('connection', (conn: LobbyConn) => this.admit(peer, conn));
    peer.on('disconnected', () => {
      // Lost the pairing service: try to keep the ID. If someone took it, 'error' follows.
      if (this.host === peer && !peer.destroyed) peer.reconnect();
    });
    peer.on('error', (err: { type?: string }) => {
      if (this.host !== peer) return;
      this.host = null;
      const links = [...this.members.keys()];
      this.members.clear();
      peer.destroy();
      for (const c of links) c.close();
      this.o.onMembers([]);
      if (err?.type === 'unavailable-id') this.join();
      else this.retry();
    });
  }

  private admit(peer: LobbyPeer, conn: LobbyConn): void {
    conn.on('data', (data: unknown) => {
      const msg = data as LobbyMessage;
      if (this.host !== peer || msg?.type !== 'LOBBY_HELLO') return;
      if (!this.members.has(conn) && this.members.size >= MAX_MEMBERS) return conn.close();
      // A member links from its own peer, so its ID is the link's peer ID, whatever it claims.
      const member = cleanMember({ ...(msg.member as object), id: conn.peer });
      if (!member) return;
      for (const [c, m] of this.members) if (m.id === member.id && c !== conn) this.members.delete(c);
      this.members.set(conn, member);
      this.broadcast();
    });
    const leave = () => {
      if (this.members.delete(conn)) this.broadcast();
    };
    conn.on('close', leave);
    conn.on('error', leave);
  }

  private broadcast(): void {
    if (!this.host) return;
    const others = [...this.members.values()];
    const everyone = [this.o.self(), ...others];
    for (const c of this.members.keys()) if (c.open) c.send({ type: 'LOBBY_LIST', members: everyone });
    this.o.onMembers(others);
  }

  private join(): void {
    if (this.stopped) return;
    const conn = this.o.mainPeer.connect(this.o.id, { reliable: true });
    if (!conn) return this.retry();
    this.link = conn;
    conn.on('open', () => {
      if (this.link !== conn) return;
      this.attempts = 0;
      conn.send({ type: 'LOBBY_HELLO', member: this.o.self() });
    });
    conn.on('data', (data: unknown) => {
      const msg = data as LobbyMessage;
      if (this.link !== conn || msg?.type !== 'LOBBY_LIST' || !Array.isArray(msg.members)) return;
      const me = this.o.self().id;
      const list = msg.members
        .slice(0, MAX_MEMBERS + 1)
        .map(cleanMember)
        .filter((m): m is LobbyMember => !!m && m.id !== me);
      this.o.onMembers(list);
    });
    const lost = () => {
      if (this.link === conn) this.dropLink();
    };
    conn.on('close', lost);
    conn.on('error', lost);
  }

  private dropLink(): void {
    const conn = this.link;
    this.link = null;
    conn?.close();
    this.o.onMembers([]);
    this.retry();
  }

  private retry(): void {
    if (this.stopped || this.timer) return;
    this.attempts += 1;
    if (this.attempts > (this.o.maxAttempts ?? 12)) return; // give up quietly: PIN pairing still works
    const rand = this.o.random ?? Math.random;
    const delay = 250 + rand() * 750 * Math.min(this.attempts, 4);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.claim();
    }, delay);
  }
}
