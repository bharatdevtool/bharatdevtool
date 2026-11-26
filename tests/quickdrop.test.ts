import { describe, it, expect, vi, afterEach } from 'vitest';
import { srflxAddress, ipv6Prefix64, networkKeys, lobbyPeerId, networkTag } from '../src/lib/quickdrop/nearby';
import { Lobby, cleanMember, visibleMembers, type LobbyMember, type LobbyPeer } from '../src/lib/quickdrop/lobby';

describe('network keys from STUN answers', () => {
  it('reads the public address of srflx candidates only', () => {
    expect(srflxAddress('candidate:842163049 1 udp 1677729535 49.36.12.34 52532 typ srflx raddr 0.0.0.0 rport 0 generation 0 ufrag ab network-cost 999')).toBe('49.36.12.34');
    expect(srflxAddress('candidate:1 1 udp 1677729535 2401:4900:1c2a:5f00::12 52532 typ srflx raddr :: rport 0')).toBe('2401:4900:1c2a:5f00::12');
    expect(srflxAddress('candidate:2 1 udp 2122260223 4b1c3e2a-1111.local 54400 typ host generation 0')).toBeNull();
    expect(srflxAddress('garbage')).toBeNull();
  });

  it('takes the /64 prefix of IPv6 addresses', () => {
    expect(ipv6Prefix64('2401:4900:1c2a:5f00:1234:5678:9abc:def0')).toBe('2401:4900:1c2a:5f00');
    expect(ipv6Prefix64('2401:4900::1')).toBe('2401:4900:0:0');
    expect(ipv6Prefix64('2401:0db8:0001:0000::1')).toBe('2401:db8:1:0');
    expect(ipv6Prefix64('fe80::1%en0')).toBe('fe80:0:0:0');
    expect(ipv6Prefix64('49.36.12.34')).toBeNull();
    expect(ipv6Prefix64('1::2::3')).toBeNull();
    expect(ipv6Prefix64('1:2:3')).toBeNull();
  });

  it('prefers IPv4 for the lobby and keeps the IPv6 prefix for filtering', () => {
    expect(networkKeys(['2401:4900:1c2a:5f00::12', '49.36.12.34'])).toEqual({ lobby: 'v4:49.36.12.34', v6: '2401:4900:1c2a:5f00' });
    expect(networkKeys(['2401:4900:1c2a:5f00::12'])).toEqual({ lobby: 'v6:2401:4900:1c2a:5f00', v6: '2401:4900:1c2a:5f00' });
    expect(networkKeys([])).toEqual({ lobby: null, v6: null });
  });

  it('hashes keys into stable PeerJS IDs that do not reveal the address', async () => {
    const a = await lobbyPeerId('v4:49.36.12.34');
    expect(a).toMatch(/^bdt-qd-lan-[0-9a-f]{24}$/);
    expect(a).toBe(await lobbyPeerId('v4:49.36.12.34'));
    expect(a).not.toBe(await lobbyPeerId('v4:49.36.12.35'));
    expect(a).not.toContain('49');
    expect(await networkTag('2401:4900:1c2a:5f00')).toMatch(/^[0-9a-f]{12}$/);
  });
});

describe('lobby members', () => {
  it('cleans device details from other devices', () => {
    expect(cleanMember({ id: 'bdt-qd-123456', name: 'x'.repeat(99), type: 'fridge', os: 'iOS' })).toEqual({
      id: 'bdt-qd-123456', name: 'x'.repeat(40), type: 'desktop', os: 'iOS', browser: '',
    });
    expect(cleanMember({ id: 'bad id!' })).toBeNull();
    expect(cleanMember(null)).toBeNull();
    expect(cleanMember({ id: 'a', net: 'not-hex' })).not.toHaveProperty('net');
  });

  it('hides strangers on a different IPv6 network and lists same-network devices first', () => {
    const m = (id: string, net?: string): LobbyMember => ({ id, name: id, type: 'mobile', os: '', browser: '', ...(net ? { net } : {}) });
    const list = [m('a'), m('b', 'ff'), m('c', 'aa')];
    expect(visibleMembers(list, 'aa').map((x) => x.id)).toEqual(['c', 'a']);
    expect(visibleMembers(list, undefined).map((x) => x.id)).toEqual(['a', 'b', 'c']);
    expect(visibleMembers(Array.from({ length: 20 }, (_, i) => m(`d${i}`)), undefined)).toHaveLength(8);
  });
});

// ── A fake PeerJS pairing service: unique IDs, async links, peer-unavailable errors ──────────
type Handler = (arg?: unknown) => void;
class Emitter {
  private handlers = new Map<string, Handler[]>();
  on(event: string, cb: Handler) {
    this.handlers.set(event, [...(this.handlers.get(event) ?? []), cb]);
    return this;
  }
  emit(event: string, arg?: unknown) {
    for (const cb of this.handlers.get(event) ?? []) cb(arg);
  }
}

class FakeConn extends Emitter {
  open = false;
  closed = false;
  other: FakeConn | null = null;
  constructor(public peer: string, public owner: FakePeer) {
    super();
  }
  send(data: unknown) {
    if (!this.open) return;
    const copy = JSON.parse(JSON.stringify(data));
    queueMicrotask(() => this.other?.open && this.other.emit('data', copy));
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    this.open = false;
    queueMicrotask(() => this.emit('close'));
    this.other?.close();
  }
}

class Broker {
  ids = new Map<string, FakePeer>();
}

class FakePeer extends Emitter {
  destroyed = false;
  conns: FakeConn[] = [];
  constructor(private broker: Broker, public id: string) {
    super();
    queueMicrotask(() => {
      if (broker.ids.has(id)) return this.emit('error', { type: 'unavailable-id' });
      broker.ids.set(id, this);
      this.emit('open', id);
    });
  }
  connect(id: string) {
    const local = new FakeConn(id, this);
    this.conns.push(local);
    queueMicrotask(() => {
      const target = this.broker.ids.get(id);
      if (!target || target.destroyed) {
        this.emit('error', { type: 'peer-unavailable', message: `Could not connect to peer ${id}` });
        return;
      }
      const remote = new FakeConn(this.id, target);
      target.conns.push(remote);
      local.other = remote;
      remote.other = local;
      target.emit('connection', remote);
      local.open = remote.open = true;
      local.emit('open');
      remote.emit('open');
    });
    return local;
  }
  reconnect() {}
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.broker.ids.get(this.id) === this) this.broker.ids.delete(this.id);
    for (const c of this.conns) c.close();
  }
}

function device(broker: Broker, name: string) {
  const main = new FakePeer(broker, `bdt-qd-${name}`);
  const state: { members: string[]; ids: string[] } = { members: [], ids: [] };
  const lobby = new Lobby({
    id: 'bdt-qd-lan-test',
    mainPeer: main as unknown as LobbyPeer,
    createPeer: (id) => new FakePeer(broker, id) as unknown as LobbyPeer,
    self: () => ({ id: main.id, name, type: 'mobile', os: 'Android', browser: 'Chrome' }),
    onMembers: (members) => {
      state.members = members.map((m) => m.name).sort();
      state.ids = members.map((m) => m.id).sort();
    },
    random: () => 0.5,
  });
  main.on('error', (err) => {
    if ((err as { type?: string })?.type === 'peer-unavailable') lobby.hostUnavailable();
  });
  return { main, lobby, state };
}

describe('nearby lobby', () => {
  afterEach(() => vi.useRealTimers());

  it('lets every device on the network see the others, and survives the host leaving', async () => {
    vi.useFakeTimers();
    const broker = new Broker();
    const a = device(broker, 'A');
    a.lobby.start();
    await vi.advanceTimersByTimeAsync(10);
    expect(a.lobby.role).toBe('host');

    const b = device(broker, 'B');
    const c = device(broker, 'C');
    b.lobby.start();
    c.lobby.start();
    await vi.advanceTimersByTimeAsync(10);
    expect(b.lobby.role).toBe('member');
    expect(a.state.members).toEqual(['B', 'C']);
    expect(b.state.members).toEqual(['A', 'C']);
    expect(c.state.members).toEqual(['A', 'B']);

    // The host closes its tab: one of the others takes over and they see each other again.
    a.lobby.stop();
    a.main.destroy();
    await vi.advanceTimersByTimeAsync(5000);
    expect([b.lobby.role, c.lobby.role].sort()).toEqual(['host', 'member']);
    expect(b.state.members).toEqual(['C']);
    expect(c.state.members).toEqual(['B']);

    // A member leaves: the host drops it from the list.
    const member = b.lobby.role === 'member' ? b : c;
    const host = member === b ? c : b;
    member.lobby.stop();
    await vi.advanceTimersByTimeAsync(10);
    expect(host.state.members).toEqual([]);
  });

  it('uses the link\'s own peer ID, whatever ID a member claims', async () => {
    vi.useFakeTimers();
    const broker = new Broker();
    const host = device(broker, 'Host');
    host.lobby.start();
    await vi.advanceTimersByTimeAsync(10);
    const liar = new Lobby({
      id: 'bdt-qd-lan-test',
      mainPeer: new FakePeer(broker, 'bdt-qd-liar') as unknown as LobbyPeer,
      createPeer: (id) => new FakePeer(broker, id) as unknown as LobbyPeer,
      self: () => ({ id: 'bdt-qd-Host', name: 'Fake', type: 'mobile', os: '', browser: '' }),
      onMembers: () => {},
    });
    liar.start();
    await vi.advanceTimersByTimeAsync(10);
    expect(liar.role).toBe('member');
    // The host listed the newcomer under its real link ID, not the ID it pretended to have.
    expect(host.state.members).toEqual(['Fake']);
    expect(host.state.ids).toEqual(['bdt-qd-liar']);
  });
});
