'use client';
/* eslint-disable react-hooks/purity -- Date.now()/Math.random() run only inside peer and click handlers, never during render. */

import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { motion, AnimatePresence } from 'framer-motion';
import type { DataConnection, Peer as PeerType } from 'peerjs';
import {
  Smartphone,
  Laptop,
  Tablet,
  QrCode,
  Share2,
  Download,
  Copy,
  Check,
  FileText,
  Image as ImageIcon,
  FileArchive,
  Film,
  Music,
  X,
  Radio,
  FileUp,
  MessageSquare,
  CheckCircle2,
  Zap,
  Loader2,
} from 'lucide-react';
import ToolLayout from '@/components/layout/ToolLayout';
import { analytics } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/config/site';
import { detectDevice, formatBytes } from '@/lib/quickdrop/device';
import { sliceAndSendFile, type ProtocolMessage, type SendOffer } from '@/lib/quickdrop/protocol';
import { Lobby, cleanMember, visibleMembers, type LobbyMember, type LobbyPeer } from '@/lib/quickdrop/lobby';
import { ICE_SERVERS, lobbyPeerId, networkKeys, networkTag, publicAddresses } from '@/lib/quickdrop/nearby';
import type { DeviceInfo, TransferProgress, TextMessage } from '@/lib/quickdrop/types';

/** Something waiting to be sent until the other device taps Accept. */
type OutboxItem = { kind: 'files'; files: File[] } | { kind: 'text'; message: TextMessage };
type ConnectedPeer = { info: DeviceInfo; conn: DataConnection; canSend: boolean };
/** A device on the radar: found on this Wi-Fi, waiting for its Accept, or connected. */
type RadarDevice = { info: DeviceInfo; state: 'nearby' | 'waiting' | 'connected' };

const LOBBY_PREFIX = 'bdt-qd-lan-';

function offerOf(items: OutboxItem[]): SendOffer {
  const files = items.flatMap((i) => (i.kind === 'files' ? i.files : []));
  return { files: files.length, bytes: files.reduce((n, f) => n + f.size, 0), texts: items.filter((i) => i.kind === 'text').length };
}

function cleanOffer(raw: unknown): SendOffer | undefined {
  const o = (raw && typeof raw === 'object' ? raw : null) as Partial<SendOffer> | null;
  if (!o) return undefined;
  const num = (v: unknown, max: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(Math.max(Math.floor(v), 0), max) : 0);
  return { files: num(o.files, 100000), bytes: num(o.bytes, 1e14), texts: num(o.texts, 1000) };
}

function describeOffer(offer?: SendOffer): string {
  if (!offer || (!offer.files && !offer.texts)) return 'files and messages';
  const parts = [];
  if (offer.files) parts.push(`${offer.files} file${offer.files === 1 ? '' : 's'} (${formatBytes(offer.bytes)})`);
  if (offer.texts) parts.push(offer.texts === 1 ? 'a message' : `${offer.texts} messages`);
  return parts.join(' and ');
}

export default function QuickDropClient() {
  const [device, setDevice] = useState<DeviceInfo>({
    id: '',
    name: 'Your Device',
    type: 'desktop',
    os: 'Windows',
    browser: 'Chrome',
  });

  const [roomId, setRoomId] = useState<string>('');
  const [targetRoomInput, setTargetRoomInput] = useState<string>('');
  const [connectedPeers, setConnectedPeers] = useState<Map<string, ConnectedPeer>>(new Map());
  const [selectedPeerId, setSelectedPeerId] = useState<string | null>(null);
  // Devices found on the same network, and whether that search works here.
  const [nearby, setNearby] = useState<LobbyMember[]>([]);
  const [nearbyStatus, setNearbyStatus] = useState<'searching' | 'on' | 'off'>('searching');
  // Devices we are waiting on to tap Accept.
  const [waiting, setWaiting] = useState<string[]>([]);

  // Transfers & Messages
  const [activeTransfers, setActiveTransfers] = useState<TransferProgress[]>([]);
  const [receivedFiles, setReceivedFiles] = useState<TransferProgress[]>([]);
  const [messages, setMessages] = useState<TextMessage[]>([]);
  const [textInput, setTextInput] = useState<string>('');
  const [textTarget, setTextTarget] = useState<string | null>(null);

  // Modals & UI States
  const [showPairModal, setShowPairModal] = useState<boolean>(false);
  const [showTextModal, setShowTextModal] = useState<boolean>(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [isDragOverStage, setIsDragOverStage] = useState<boolean>(false);
  // Devices that connected to us and wait for "Accept".
  const [pendingRequests, setPendingRequests] = useState<{ info: DeviceInfo; conn: DataConnection; offer?: SendOffer }[]>([]);
  const [notice, setNotice] = useState<string>('');
  const [dragOverPeerId, setDragOverPeerId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const targetPeerForFileRef = useRef<string | null>(null);
  const peerInstanceRef = useRef<PeerType | null>(null);
  const incomingChunksRef = useRef<Map<string, { chunks: ArrayBuffer[]; total: number; name: string; type: string; size: number }>>(new Map());
  const transferStatsRef = useRef<Map<string, { lastBytes: number; lastTime: number; speed: number }>>(new Map());
  const deviceRef = useRef<DeviceInfo>(device);
  const approvedRef = useRef<Set<DataConnection>>(new Set()); // we take data from these links
  const canSendRef = useRef<Set<DataConnection>>(new Set()); // the other device accepted these links
  const connsRef = useRef<Map<string, DataConnection>>(new Map()); // newest link per device
  const trustedRef = useRef<Set<string>>(new Set()); // devices accepted (or chosen) during this visit
  const outboxRef = useRef<Map<string, OutboxItem[]>>(new Map()); // waiting for the other device's Accept
  const namesRef = useRef<Map<string, string>>(new Map()); // device names, for notices
  const lobbyRef = useRef<Lobby | null>(null);
  const handlersRef = useRef<{
    setup: (conn: DataConnection, outgoing: boolean) => void;
    connect: (code: string) => void;
    unavailable: (peerId: string) => void;
  } | null>(null);
  const receivedBytesRef = useRef<Map<string, number>>(new Map());

  // 1. Initialize Device, PIN and nearby search
  useEffect(() => {
    const dev = detectDevice();
    // Reads navigator.userAgent, which only exists in the browser: must run after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDevice(dev);

    deviceRef.current = dev;

    // A QR code / link carries the OTHER device's PIN: connect to it once we are online.
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    let joinPin = roomParam && /^\d{6}$/.test(roomParam) ? roomParam : null;
    if (roomParam !== null) history.replaceState(history.state, '', window.location.pathname);

    let isMounted = true;
    let attempts = 0;
    let nearbyStarted = false;

    async function initPeer() {
      try {
        const { default: Peer } = await import('peerjs');
        // This device's PIN IS its peer ID, so "enter PIN" and "scan QR" reach exactly this device.
        const myRoom = Math.floor(100000 + Math.random() * 900000).toString();
        const peerId = `bdt-qd-${myRoom}`;
        attempts += 1;

        const peer = new Peer(peerId, { debug: 1, config: { iceServers: ICE_SERVERS } });

        peerInstanceRef.current = peer;

        // Devices on the same Wi-Fi meet in a lobby named after the network (see lib/quickdrop/nearby).
        const startNearby = async () => {
          const keys = networkKeys(await publicAddresses());
          if (!isMounted || peer.destroyed) return;
          if (!keys.lobby) return setNearbyStatus('off');
          const [lobbyId, net] = await Promise.all([lobbyPeerId(keys.lobby), keys.v6 ? networkTag(keys.v6) : undefined]);
          if (!isMounted || peer.destroyed) return;
          const lobby = new Lobby({
            id: lobbyId,
            mainPeer: peer as unknown as LobbyPeer,
            createPeer: (id) => new Peer(id, { debug: 0, config: { iceServers: ICE_SERVERS } }) as unknown as LobbyPeer,
            self: () => ({ ...deviceRef.current, id: peer.id, ...(net ? { net } : {}) }),
            onMembers: (members) => {
              if (!isMounted) return;
              for (const m of members) namesRef.current.set(m.id, m.name);
              setNearby(visibleMembers(members, net));
            },
          });
          lobbyRef.current = lobby;
          lobby.start();
          setNearbyStatus('on');
        };

        peer.on('open', (id) => {
          if (!isMounted) return;
          setRoomId(myRoom);
          setDevice((prev) => ({ ...prev, id }));
          if (joinPin && joinPin !== myRoom) handlersRef.current?.connect(joinPin);
          joinPin = null;
          if (!nearbyStarted) {
            nearbyStarted = true;
            startNearby().catch(() => isMounted && setNearbyStatus('off'));
          }

          const pairUrl = `${window.location.origin}/quickdrop?room=${myRoom}`;
          QRCode.toDataURL(pairUrl, {
            width: 360,
            margin: 2,
            color: {
              dark: '#0f172a',
              light: '#ffffff',
            },
          })
            .then((url) => isMounted && setQrDataUrl(url))
            .catch(() => {});
        });

        peer.on('connection', (conn) => {
          handlersRef.current?.setup(conn, false);
        });

        // Phones drop the pairing link when the screen locks: rejoin with the same PIN.
        peer.on('disconnected', () => {
          setTimeout(() => {
            if (isMounted && !peer.destroyed && peer.disconnected) peer.reconnect();
          }, 1000);
        });

        peer.on('error', (err: { type?: string; message?: string }) => {
          if (!isMounted) return;
          if (err?.type === 'unavailable-id' && attempts < 5 && !nearbyStarted) {
            // PIN already taken by another device: pick a new one.
            peer.destroy();
            initPeer();
            return;
          }
          if (err?.type === 'peer-unavailable') {
            handlersRef.current?.unavailable(/bdt-qd-[\w-]+/.exec(err.message || '')?.[0] ?? '');
            return;
          }
          console.warn('[QuickDrop] Peer error:', err?.type);
          setNotice('Could not reach the pairing service. Check your internet connection and reload.');
        });
      } catch (err) {
        console.error('[QuickDrop] Failed to initialize peer:', err);
        if (isMounted) setNearbyStatus('off');
      }
    }

    initPeer();

    return () => {
      isMounted = false;
      lobbyRef.current?.stop();
      lobbyRef.current = null;
      if (peerInstanceRef.current) {
        peerInstanceRef.current.destroy();
      }
    };
  }, []);

  const nameOf = (peerId: string) => namesRef.current.get(peerId) || 'The other device';

  function setupConnectionListeners(conn: DataConnection, outgoing: boolean) {
    // We chose this device (tapped it, or typed its PIN), so we take its data and trust it for this
    // visit. A device that connects to us is the one asking: it takes ours, we take its data only
    // after Accept.
    if (outgoing) {
      approvedRef.current.add(conn);
      trustedRef.current.add(conn.peer);
    } else {
      canSendRef.current.add(conn);
    }
    connsRef.current.set(conn.peer, conn);

    conn.on('open', () => {
      conn.send({
        type: 'HANDSHAKE',
        device: deviceRef.current,
        ...(outgoing ? { offer: offerOf(outboxRef.current.get(conn.peer) ?? []) } : {}),
      });
    });

    conn.on('data', (data: unknown) => {
      handleIncomingData(conn, data as ProtocolMessage);
    });

    conn.on('close', () => {
      approvedRef.current.delete(conn);
      canSendRef.current.delete(conn);
      if (connsRef.current.get(conn.peer) === conn) {
        connsRef.current.delete(conn.peer);
        if (outboxRef.current.has(conn.peer)) {
          dropOutbox(conn.peer);
          setNotice(`Could not send to ${nameOf(conn.peer)}: the connection closed before they accepted.`);
        }
      }
      setPendingRequests((prev) => prev.filter((r) => r.conn !== conn));
      setConnectedPeers((prev) => {
        if (prev.get(conn.peer)?.conn !== conn) return prev;
        const next = new Map(prev);
        next.delete(conn.peer);
        return next;
      });
      setSelectedPeerId((prev) => (prev === conn.peer ? null : prev));
    });

    conn.on('error', (err: { type?: string }) => {
      console.warn('[QuickDrop] Connection error:', err?.type);
    });
  }

  function addPeer(conn: DataConnection, info: DeviceInfo) {
    setConnectedPeers((prev) => {
      const next = new Map(prev);
      next.set(conn.peer, { info, conn, canSend: canSendRef.current.has(conn) });
      return next;
    });
    setSelectedPeerId((prev) => prev || conn.peer);
  }

  /** This device takes the other one's files and messages from now on. */
  function acceptConn(conn: DataConnection, info: DeviceInfo) {
    approvedRef.current.add(conn);
    trustedRef.current.add(conn.peer);
    if (conn.open) conn.send({ type: 'ACCEPTED' });
    addPeer(conn, info);
  }

  function allowRequest(conn: DataConnection) {
    const req = pendingRequests.find((r) => r.conn === conn);
    setPendingRequests((prev) => prev.filter((r) => r.conn !== conn));
    if (!req || !conn.open) return;
    acceptConn(conn, req.info);
  }

  function declineRequest(conn: DataConnection) {
    setPendingRequests((prev) => prev.filter((r) => r.conn !== conn));
    try {
      if (conn.open) conn.send({ type: 'DECLINED' });
    } catch {}
    setTimeout(() => {
      try { conn.close(); } catch {}
    }, 300);
  }

  function dropOutbox(peerId: string) {
    outboxRef.current.delete(peerId);
    setWaiting((prev) => prev.filter((id) => id !== peerId));
  }

  /** Stop waiting for a device's Accept and forget what was queued for it. */
  function cancelWaiting(peerId: string) {
    dropOutbox(peerId);
    const conn = connsRef.current.get(peerId);
    if (conn && !canSendRef.current.has(conn)) {
      try { conn.close(); } catch {}
    }
  }

  function handleUnavailable(peerId: string) {
    if (peerId.startsWith(LOBBY_PREFIX)) {
      lobbyRef.current?.hostUnavailable();
      return;
    }
    if (outboxRef.current.has(peerId)) {
      dropOutbox(peerId);
      connsRef.current.delete(peerId);
      setNearby((prev) => prev.filter((m) => m.id !== peerId));
      setNotice(`${nameOf(peerId)} is no longer reachable. Keep QuickDrop open on it and try again.`);
      return;
    }
    setNotice('No device found with that PIN. Check the PIN and keep QuickDrop open on the other device.');
  }

  function handleIncomingData(conn: DataConnection, data: ProtocolMessage) {
    if (!data || !data.type) return;

    if (data.type === 'HANDSHAKE') {
      const info = cleanMember({ ...(data.device ?? {}), id: conn.peer });
      if (!info) return;
      namesRef.current.set(conn.peer, info.name);
      // Our own link (we chose this device), or one we accepted earlier in this visit.
      if (approvedRef.current.has(conn)) addPeer(conn, info);
      else if (trustedRef.current.has(conn.peer)) acceptConn(conn, info);
      else setPendingRequests((prev) => [...prev.filter((r) => r.conn !== conn), { info, conn, offer: cleanOffer(data.offer) }]);
      return;
    }

    if (data.type === 'ACCEPTED') {
      if (canSendRef.current.has(conn)) return;
      canSendRef.current.add(conn);
      setConnectedPeers((prev) => {
        const p = prev.get(conn.peer);
        if (!p || p.conn !== conn) return prev;
        const next = new Map(prev);
        next.set(conn.peer, { ...p, canSend: true });
        return next;
      });
      const items = outboxRef.current.get(conn.peer) ?? [];
      dropOutbox(conn.peer);
      for (const item of items) sendItem(conn, item);
      return;
    }

    if (data.type === 'DECLINED') {
      dropOutbox(conn.peer);
      setNotice(`${nameOf(conn.peer)} declined.`);
      try { conn.close(); } catch {}
      return;
    }

    // Nothing else until this device has accepted the sender.
    if (!approvedRef.current.has(conn)) return;

    switch (data.type) {
      case 'FILE_HEADER': {
        incomingChunksRef.current.set(data.fileId, {
          chunks: [],
          total: data.totalChunks,
          name: data.name,
          type: data.mimeType,
          size: data.size,
        });

        transferStatsRef.current.set(data.fileId, {
          lastBytes: 0,
          lastTime: Date.now(),
          speed: 0,
        });

        const newTransfer: TransferProgress = {
          id: data.fileId,
          fileName: data.name,
          fileSize: data.size,
          fileType: data.mimeType,
          bytesTransferred: 0,
          progress: 0,
          speed: 0,
          direction: 'receiving',
          status: 'transferring',
        };

        setActiveTransfers((prev) => [newTransfer, ...prev]);
        break;
      }

      case 'FILE_CHUNK': {
        const session = incomingChunksRef.current.get(data.fileId);
        if (!session) return;

        if (session.chunks[data.chunkIndex]) return;
        session.chunks[data.chunkIndex] = data.data;
        const currentBytes = (receivedBytesRef.current.get(data.fileId) || 0) + data.data.byteLength;
        receivedBytesRef.current.set(data.fileId, currentBytes);
        const progress = Math.min(100, Math.round((currentBytes / session.size) * 100));

        // Speed calculation
        const now = Date.now();
        const stat = transferStatsRef.current.get(data.fileId);
        let speed = 0;
        if (stat) {
          const dt = (now - stat.lastTime) / 1000;
          if (dt >= 0.25) {
            speed = Math.round((currentBytes - stat.lastBytes) / dt);
            stat.lastBytes = currentBytes;
            stat.lastTime = now;
            stat.speed = speed;
          } else {
            speed = stat.speed;
          }
        }

        setActiveTransfers((prev) =>
          prev.map((t) => (t.id === data.fileId ? { ...t, bytesTransferred: currentBytes, progress, speed } : t))
        );
        break;
      }

      case 'FILE_COMPLETE': {
        const session = incomingChunksRef.current.get(data.fileId);
        if (!session) return;

        const safeName = String(session.name).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 200) || 'file';
        session.name = safeName;
        const blob = new Blob(session.chunks, { type: session.type });
        const downloadUrl = URL.createObjectURL(blob);

        const completedTransfer: TransferProgress = {
          id: data.fileId,
          fileName: session.name,
          fileSize: session.size,
          fileType: session.type,
          bytesTransferred: session.size,
          progress: 100,
          speed: 0,
          direction: 'receiving',
          status: 'completed',
          blob,
          downloadUrl,
        };

        setActiveTransfers((prev) => prev.filter((t) => t.id !== data.fileId));
        setReceivedFiles((prev) => [completedTransfer, ...prev]);
        incomingChunksRef.current.delete(data.fileId);
        transferStatsRef.current.delete(data.fileId);
        receivedBytesRef.current.delete(data.fileId);

        // Auto trigger download for instant utility
        try {
          const a = document.createElement('a');
          a.href = downloadUrl;
          a.download = session.name;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        } catch {}
        break;
      }

      case 'TEXT_MESSAGE': {
        setMessages((prev) => [data.message, ...prev]);
        break;
      }
    }
  }

  function connectToRoomCode(targetCode: string) {
    if (!peerInstanceRef.current || !targetCode) return;
    const cleanCode = targetCode.replace(/\D/g, '');
    if (!/^\d{6}$/.test(cleanCode)) {
      setNotice('Enter the 6-digit PIN shown on the other device.');
      return;
    }
    if (cleanCode === roomId) {
      setNotice('That is this device\'s own PIN. Enter the PIN shown on the other device.');
      return;
    }

    setNotice('');
    const conn = peerInstanceRef.current.connect(`bdt-qd-${cleanCode}`, { reliable: true });

    if (conn) {
      setupConnectionListeners(conn, true);
      setShowPairModal(false);
      setTargetRoomInput('');
    }
  }

  /** Send now if the device has accepted us; otherwise connect, ask, and send after Accept. */
  function deliver(peerId: string, item: OutboxItem) {
    const conn = connsRef.current.get(peerId);
    if (conn?.open && canSendRef.current.has(conn)) {
      sendItem(conn, item);
      return;
    }
    outboxRef.current.set(peerId, [...(outboxRef.current.get(peerId) ?? []), item]);
    setWaiting((prev) => (prev.includes(peerId) ? prev : [...prev, peerId]));
    if (conn) return; // already connecting: the queue goes out after Accept
    const next = peerInstanceRef.current?.connect(peerId, { reliable: true });
    if (next) {
      setupConnectionListeners(next, true);
    } else {
      dropOutbox(peerId);
      setNotice('Not connected to the pairing service. Check your internet connection and reload.');
    }
  }

  function sendItem(conn: DataConnection, item: OutboxItem) {
    if (item.kind === 'text') {
      conn.send({ type: 'TEXT_MESSAGE', message: item.message });
      setMessages((prev) => [item.message, ...prev]);
      return;
    }
    sendFilesOver(conn, item.files);
  }

  async function sendFilesOver(conn: DataConnection, files: File[]) {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileId = `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

      transferStatsRef.current.set(fileId, {
        lastBytes: 0,
        lastTime: Date.now(),
        speed: 0,
      });

      const newTransfer: TransferProgress = {
        id: fileId,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type || 'application/octet-stream',
        bytesTransferred: 0,
        progress: 0,
        speed: 0,
        direction: 'sending',
        status: 'transferring',
      };

      setActiveTransfers((prev) => [newTransfer, ...prev]);

      try {
        await sliceAndSendFile(
          file,
          fileId,
          async (msg) => {
            if (!conn.open) throw new Error('Connection closed');
            // Wait while the channel is backed up: sending a whole file at once overflows it.
            while (conn.open && ((conn.dataChannel?.bufferedAmount ?? 0) > 4 * 1024 * 1024 || ((conn as unknown as { bufferSize?: number }).bufferSize ?? 0) > 64)) {
              await new Promise((r) => setTimeout(r, 20));
            }
            conn.send(msg);
          },
          (sentBytes, totalBytes) => {
            const progress = Math.min(100, Math.round((sentBytes / totalBytes) * 100));

            const now = Date.now();
            const stat = transferStatsRef.current.get(fileId);
            let speed = 0;
            if (stat) {
              const dt = (now - stat.lastTime) / 1000;
              if (dt >= 0.25) {
                speed = Math.round((sentBytes - stat.lastBytes) / dt);
                stat.lastBytes = sentBytes;
                stat.lastTime = now;
                stat.speed = speed;
              } else {
                speed = stat.speed;
              }
            }

            setActiveTransfers((prev) =>
              prev.map((t) => (t.id === fileId ? { ...t, bytesTransferred: sentBytes, progress, speed } : t))
            );
          }
        );

        setActiveTransfers((prev) =>
          prev.map((t) => (t.id === fileId ? { ...t, status: 'completed', progress: 100, speed: 0 } : t))
        );
        transferStatsRef.current.delete(fileId);
      } catch (err) {
        console.error('[QuickDrop] Send error:', err);
        setActiveTransfers((prev) =>
          prev.map((t) => (t.id === fileId ? { ...t, status: 'error', error: 'Transfer stopped: the other device disconnected.' } : t))
        );
        transferStatsRef.current.delete(fileId);
      }
    }
  }

  // Everyone on the radar: connected devices first, then the rest of the Wi-Fi.
  const radar: RadarDevice[] = [];
  for (const { info, canSend } of connectedPeers.values()) {
    radar.push({ info, state: canSend && !waiting.includes(info.id) ? 'connected' : 'waiting' });
  }
  for (const m of nearby) {
    if (!connectedPeers.has(m.id)) radar.push({ info: m, state: waiting.includes(m.id) ? 'waiting' : 'nearby' });
  }
  const radarShown = radar.slice(0, 8);

  /** Where a drop or "Select Files" goes when no device was tapped. */
  function defaultTarget(): string | null {
    if (selectedPeerId && radar.some((d) => d.info.id === selectedPeerId)) return selectedPeerId;
    return radar.length === 1 ? radar[0].info.id : null;
  }

  function handleSendFiles(files: FileList | File[], specificPeerId?: string) {
    const list = Array.from(files);
    if (!list.length) return;
    const target = specificPeerId || defaultTarget();
    if (!target) {
      if (radar.length === 0) setShowPairModal(true);
      else setNotice('Drop the files on a device, or tap the device you want to send to.');
      return;
    }
    analytics.track(ANALYTICS_EVENTS.QUICKDROP_SEND, {
      files: list.length,
      via: nearby.some((m) => m.id === target) ? 'nearby' : 'pin',
    });
    deliver(target, { kind: 'files', files: list });
  }

  function openTextModal() {
    setTextTarget(defaultTarget() ?? radar[0]?.info.id ?? null);
    setShowTextModal(true);
  }

  function handleSendTextMessage() {
    if (!textInput.trim()) return;
    const target = textTarget && radar.some((d) => d.info.id === textTarget) ? textTarget : defaultTarget();
    if (!target) {
      setShowTextModal(false);
      setShowPairModal(true);
      return;
    }

    deliver(target, {
      kind: 'text',
      message: {
        id: `${Date.now()}`,
        senderName: device.name,
        text: textInput.trim(),
        timestamp: Date.now(),
      },
    });
    setTextInput('');
    setShowTextModal(false);
  }

  /** Tap on the radar's own device: send to the only device, or explain what to do. */
  function handleCenterTap() {
    const target = defaultTarget();
    if (target) triggerPeerFileSelect(target);
    else if (radar.length === 0) setShowPairModal(true);
    else setNotice('Tap the device you want to send to.');
  }

  function triggerPeerFileSelect(peerId: string) {
    targetPeerForFileRef.current = peerId;
    setSelectedPeerId(peerId);
    fileInputRef.current?.click();
  }

  function formatSpeed(bytesPerSec: number): string {
    if (!bytesPerSec || bytesPerSec <= 0) return '';
    return `${formatBytes(bytesPerSec)}/s`;
  }

  function getFileIcon(mime: string, name: string) {
    if (mime.startsWith('image/')) return <ImageIcon className="w-5 h-5 text-blue-500 shrink-0" />;
    if (mime.startsWith('video/')) return <Film className="w-5 h-5 text-purple-500 shrink-0" />;
    if (mime.startsWith('audio/')) return <Music className="w-5 h-5 text-emerald-500 shrink-0" />;
    if (mime.includes('zip') || mime.includes('rar') || name.endsWith('.zip')) {
      return <FileArchive className="w-5 h-5 text-amber-500 shrink-0" />;
    }
    return <FileText className="w-5 h-5 text-indigo-500 shrink-0" />;
  }

  function getDeviceIcon(type: string, className = 'w-6 h-6') {
    if (type === 'mobile') return <Smartphone className={className} />;
    if (type === 'tablet') return <Tablet className={className} />;
    return <Laptop className={className} />;
  }

  function getPeerPosition(peerId: string, index: number) {
    // Strategic angles around the ripple waves that cleanly float outside the central square and bottom text
    const angles = [-35, -145, 32, 148, -80, -12, -168, 68];
    const angleDeg = angles[index % angles.length];
    const angleRad = (angleDeg * Math.PI) / 180;

    // Stable pseudo-random variation based on peerId so position stays consistent
    let hash = 0;
    for (let i = 0; i < peerId.length; i++) {
      hash = (hash << 5) - hash + peerId.charCodeAt(i);
    }
    const jitter = (Math.abs(hash) % 20) - 5; // -5px to +14px

    // Distance places the device clearly floating on the 3rd/4th expanding ripple ring:
    // Mobile (~148px radius) vs Desktop (~200px radius)
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
    const radius = (isMobile ? 146 : 202) + jitter;

    const x = Math.round(Math.cos(angleRad) * radius);
    const y = Math.round(Math.sin(angleRad) * radius);

    return { x, y };
  }

  const nearbyLabel =
    nearbyStatus === 'on'
      ? 'Visible to devices on this Wi-Fi'
      : nearbyStatus === 'searching'
        ? 'Looking for devices on this Wi-Fi'
        : 'Nearby search is blocked here: use PIN or QR';

  // Peer callbacks are registered once; they call the latest handlers through this ref.
  useEffect(() => {
    handlersRef.current = { setup: setupConnectionListeners, connect: connectToRoomCode, unavailable: handleUnavailable };
  });

  return (
    <ToolLayout toolId="quickdrop">
      <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-2">

        {pendingRequests.map((req) => (
          <div key={req.conn.connectionId || req.conn.peer} role="alert" className="mb-3 flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-blue-500/40 bg-blue-500/10 px-4 py-3 text-sm">
            <span className="flex-1">
              <strong>{req.info.name}</strong>
              {req.info.os ? ` (${req.info.os}${req.info.browser ? ', ' + req.info.browser : ''})` : ''} wants to send you {describeOffer(req.offer)}.
              <span className="block text-xs text-muted-foreground mt-0.5">Accept only devices you know. After you accept, it can send you more until you close this page.</span>
            </span>
            <div className="flex gap-2">
              <button type="button" onClick={() => allowRequest(req.conn)} className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 cursor-pointer">Accept</button>
              <button type="button" onClick={() => declineRequest(req.conn)} className="px-4 py-1.5 rounded-lg border border-border text-xs font-bold hover:bg-muted cursor-pointer">Decline</button>
            </div>
          </div>
        ))}

        {waiting.map((id) => (
          <div key={id} role="status" className="mb-3 flex items-center gap-3 rounded-xl border border-border bg-muted/50 px-4 py-2.5 text-sm">
            <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
            <span className="flex-1">Waiting for <strong>{radar.find((d) => d.info.id === id)?.info.name ?? 'the other device'}</strong> to tap Accept…</span>
            <button type="button" onClick={() => cancelWaiting(id)} className="px-3 py-1 rounded-lg border border-border text-xs font-bold hover:bg-muted cursor-pointer">Cancel</button>
          </div>
        ))}

        {notice && (
          <div role="status" className="mb-3 flex items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm">
            <span className="flex-1">{notice}</span>
            <button type="button" onClick={() => setNotice('')} aria-label="Dismiss" className="p-1 rounded hover:bg-muted cursor-pointer"><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* 1. COMPACT MINIMAL HEADER BAR (NO UNNECESSARY NESTING) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border/50 text-sm">
          {/* Device identity */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Laptop className="w-5 h-5" />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-foreground text-base">{device.name}</span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${nearbyStatus === 'off' ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'}`}>
                <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${nearbyStatus === 'off' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                {nearbyLabel}
              </span>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowPairModal(true)}
              title="Connect a device on another network"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-foreground text-xs font-medium transition-all active:scale-95 cursor-pointer"
            >
              <QrCode className="w-3.5 h-3.5 text-primary" />
              <span>PIN / QR</span>
            </button>
            <button
              onClick={openTextModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-foreground text-xs font-medium transition-all active:scale-95 cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5 text-primary" />
              <span>Send Text</span>
            </button>
          </div>
        </div>

        {/* 2. THE REAL ANIMATED RADAR STAGE (POWERED BY FRAMER MOTION) */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOverStage(true);
          }}
          onDragLeave={(e) => {
            if (e.currentTarget.contains(e.relatedTarget as Node)) return;
            setIsDragOverStage(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOverStage(false);
            setDragOverPeerId(null);
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
              handleSendFiles(e.dataTransfer.files);
            }
          }}
          className={`relative w-full min-h-[440px] sm:min-h-[480px] my-6 flex items-center justify-center transition-all select-none rounded-3xl ${
            isDragOverStage
              ? 'animate-drop-glow bg-blue-50/50 dark:bg-blue-950/30'
              : ''
          }`}
        >
          {/* DRAG-AND-DROP ACTIVE GLOW OVERLAY */}
          {isDragOverStage && (
            <div className="absolute inset-0 z-40 backdrop-blur-2xs flex flex-col items-center justify-center p-6 animate-in fade-in duration-150 rounded-3xl pointer-events-none">
              <div className="w-16 h-16 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center mb-3 animate-bounce shadow-xl">
                <FileUp className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-1">
                Drop files to share
              </h3>
              <p className="text-xs text-muted-foreground">
                Release anywhere to beam files directly
              </p>
            </div>
          )}

          {/* RIPPLE CANVAS: HOUSES EXPANDING RIPPLE WAVES & CENTRAL LAPTOP */}
          <div className="relative w-[360px] h-[360px] sm:w-[480px] sm:h-[480px] flex items-center justify-center">

            {/* 5 CONTINUOUS EXPANDING RIPPLE WAVES RADIATING FROM THE LAPTOP */}
            {[0, 1, 2, 3, 4].map((idx) => (
              <motion.div
                key={idx}
                className="absolute rounded-full pointer-events-none"
                style={{
                  width: 140,
                  height: 140,
                  border: '1.5px solid rgba(79, 110, 255, 0.65)',
                }}
                animate={{
                  scale: [0.5, 4.0],
                  opacity: [0.8, 0.45, 0],
                }}
                transition={{
                  duration: 4.2,
                  repeat: Infinity,
                  ease: 'linear',
                  delay: idx * 0.84,
                }}
              />
            ))}

            {/* CENTRAL DEVICE (DEAD CENTER IN RIPPLE CIRCLES) */}
            <motion.div
              onClick={handleCenterTap}
              title="This device. Tap a device around it to send files."
              animate={{
                scale: [1, 1.035, 1],
                boxShadow: [
                  '0 10px 35px rgba(59, 130, 246, 0.35)',
                  '0 16px 48px rgba(99, 102, 241, 0.55)',
                  '0 10px 35px rgba(59, 130, 246, 0.35)',
                ],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.95 }}
              className="relative z-20 w-32 h-32 sm:w-36 sm:h-36 rounded-3xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 text-white flex items-center justify-center cursor-pointer shadow-2xl"
            >
              <Laptop className="w-16 h-16 sm:w-18 sm:h-18 transition-transform" />

              {/* Green online indicator above laptop icon */}
              <span className="absolute -bottom-1 -right-1 z-20 flex h-5 w-5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-5 w-5 bg-emerald-500 border-2 border-background"></span>
              </span>
            </motion.div>

            {/* Device Name and Broadcasting Status (Positioned below the centered box without offsetting it) */}
            <div className="absolute top-[calc(50%+76px)] sm:top-[calc(50%+86px)] z-20 flex flex-col items-center text-center">
              <h2 className="text-base sm:text-lg font-bold text-foreground">
                {device.name}
              </h2>
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                <Radio className="w-3 h-3 text-primary animate-pulse" />
                {nearbyLabel}
              </span>
            </div>

            {/* NEARBY DISCOVERED PEERS (DYNAMICALLY POSITIONED ON RIPPLE WAVES AWAY FROM CENTER) */}
            <AnimatePresence>
              {radarShown.map(({ info, state }, idx) => {
                const isDragTarget = dragOverPeerId === info.id;
                const pos = getPeerPosition(info.id, idx);

                return (
                  <div
                    key={info.id}
                    style={{
                      position: 'absolute',
                      left: `calc(50% + ${pos.x}px)`,
                      top: `calc(50% + ${pos.y}px)`,
                      transform: 'translate(-50%, -50%)',
                      zIndex: 30,
                    }}
                  >
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{
                        scale: isDragTarget ? 1.15 : 1,
                        opacity: 1,
                        y: [0, -6, 0],
                      }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{
                        y: { duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: (idx % 3) * 0.5 },
                        scale: { duration: 0.2 },
                        opacity: { duration: 0.25 },
                      }}
                      onClick={() => triggerPeerFileSelect(info.id)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDragOverPeerId(info.id);
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDragOverPeerId(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDragOverPeerId(null);
                        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                          handleSendFiles(e.dataTransfer.files, info.id);
                        }
                      }}
                      className="flex flex-col items-center cursor-pointer group"
                    >
                      <div
                        className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-card border-2 flex items-center justify-center shadow-lg transition-all ${
                          isDragTarget
                            ? 'border-primary ring-4 ring-primary/30 bg-primary/10'
                            : 'border-border/80 group-hover:border-primary group-hover:shadow-primary/25'
                        }`}
                      >
                        {state === 'waiting'
                          ? <Loader2 className="w-7 h-7 text-primary animate-spin" />
                          : getDeviceIcon(info.type, 'w-7 h-7 text-foreground group-hover:text-primary transition-colors')}
                        {state === 'connected' && (
                          <span className="absolute -top-1 -right-1 flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                          </span>
                        )}
                      </div>

                      <div className="mt-1.5 text-center px-2 py-0.5 rounded-full bg-background/85 backdrop-blur-xs border border-border/50 shadow-2xs">
                        <span className="text-xs font-bold text-foreground block truncate max-w-[100px]">
                          {info.name}
                        </span>
                        <span className="text-[10px] text-muted-foreground block">
                          {state === 'waiting' ? 'Waiting…' : state === 'connected' ? 'Connected' : info.os || 'Nearby'}
                        </span>
                      </div>
                    </motion.div>
                  </div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Hidden File Picker */}
          <input
            type="file"
            ref={fileInputRef}
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleSendFiles(e.target.files, targetPeerForFileRef.current || undefined);
                targetPeerForFileRef.current = null;
              }
            }}
          />
        </div>

        {/* 3. CLEAN FILE SHARING ACTIONS BELOW RADAR (COMPACT, INTEGRATED — NO GIANT CARD) */}
        <div className="flex flex-col items-center text-center space-y-3 py-2">
          <h3 className="text-base font-semibold text-foreground">
            {radar.length > 0 ? 'Tap a device to send files' : 'Ready to share?'}
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-md">
            {radar.length > 0
              ? 'Or drop files on it. The other device taps Accept once, then files go straight across.'
              : 'Open bharatdevtool.com/quickdrop on your other device on the same Wi-Fi. It shows up here by itself, no PIN needed.'}
          </p>

          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={() => {
                const target = defaultTarget();
                if (target) targetPeerForFileRef.current = target;
                if (fileInputRef.current) fileInputRef.current.click();
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs sm:text-sm font-semibold hover:opacity-90 active:scale-95 transition-all shadow-md shadow-primary/20 cursor-pointer"
            >
              <FileUp className="w-4 h-4" />
              <span>Select Files</span>
            </button>

            <button
              onClick={() => setShowPairModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border bg-background hover:bg-muted text-foreground text-xs sm:text-sm font-medium transition-all active:scale-95 cursor-pointer"
            >
              <QrCode className="w-4 h-4 text-muted-foreground" />
              <span>Other network? PIN / QR</span>
            </button>
          </div>
        </div>

        {/* 4. ACTIVE TRANSFERS (CLEAN STREAMLINED LIST) */}
        {activeTransfers.length > 0 && (
          <div className="space-y-3 pt-6 animate-in fade-in duration-200">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-primary animate-pulse" />
                Active Transfers ({activeTransfers.length})
              </span>
            </div>

            <div className="space-y-2">
              {activeTransfers.map((t) => (
                <div
                  key={t.id}
                  className="p-3.5 rounded-xl border border-border/80 bg-card/60 backdrop-blur-xs transition-all"
                >
                  <div className="flex items-center justify-between mb-2 gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {getFileIcon(t.fileType, t.fileName)}
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-foreground truncate">{t.fileName}</div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                          <span>{formatBytes(t.bytesTransferred)} of {formatBytes(t.fileSize)}</span>
                          {t.speed > 0 && (
                            <>
                              <span>•</span>
                              <span className="font-mono text-primary font-medium">{formatSpeed(t.speed)}</span>
                            </>
                          )}
                          <span>•</span>
                          <span className="capitalize">{t.direction}</span>
                        </div>
                      </div>
                    </div>

                    <span className="text-sm font-mono font-bold text-primary shrink-0">
                      {t.progress}%
                    </span>
                  </div>

                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-blue-600 to-indigo-600 h-2 rounded-full transition-all duration-150"
                      style={{ width: `${t.progress}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. RECEIVED FILES DOCK */}
        {receivedFiles.length > 0 && (
          <div className="space-y-3 pt-6 animate-in fade-in duration-200">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                Received Files ({receivedFiles.length})
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {receivedFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-border/70 bg-card/60 hover:border-primary/40 transition-all"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {getFileIcon(file.fileType, file.fileName)}
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-bold text-foreground truncate">{file.fileName}</div>
                      <span className="text-[11px] text-muted-foreground">{formatBytes(file.fileSize)}</span>
                    </div>
                  </div>

                  {file.downloadUrl && (
                    <a
                      href={file.downloadUrl}
                      download={file.fileName}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold transition-colors shrink-0 ml-2"
                      title="Download file"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Save</span>
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 6. SHARED TEXT NOTES & LINKS */}
        {messages.length > 0 && (
          <div className="space-y-3 pt-6 animate-in fade-in duration-200">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-primary" />
                Shared Notes ({messages.length})
              </span>
            </div>

            <div className="space-y-2">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className="p-3 rounded-xl border border-border/70 bg-card/60 flex justify-between items-start gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold text-primary mb-0.5">
                      From {m.senderName}
                    </div>
                    <p className="text-xs sm:text-sm text-foreground whitespace-pre-wrap break-words">{m.text}</p>
                  </div>
                  <button
                    onClick={() => navigator.clipboard.writeText(m.text)}
                    className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground shrink-0 transition-colors"
                    title="Copy note"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 7. PAIRING MODAL */}
        {showPairModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-3xl max-w-sm w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
              <button
                onClick={() => setShowPairModal(false)}
                className="absolute right-4 top-4 p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="text-center mb-5">
                <h3 className="text-lg font-bold text-foreground">Connect with PIN or QR</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Only needed when the other device is on a different network (for example mobile data). On the same Wi-Fi, devices show up by themselves.
                </p>
              </div>

              {/* QR Code Container */}
              {qrDataUrl && (
                <div className="flex justify-center mb-5">
                  <div className="p-3 bg-white rounded-2xl border border-gray-200 shadow-sm">
                    <img src={qrDataUrl} alt="QuickDrop Pair QR Code" className="w-48 h-48" />
                  </div>
                </div>
              )}

              {/* Direct Room PIN Display */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/60 border border-border mb-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                    Your Room PIN
                  </span>
                  <span className="text-2xl font-mono font-extrabold text-foreground tracking-widest">
                    {roomId}
                  </span>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(roomId);
                    setCopiedCode(true);
                    setTimeout(() => setCopiedCode(false), 2000);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-background border border-border hover:bg-muted text-xs font-semibold text-foreground flex items-center gap-1 transition-colors cursor-pointer"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              {/* Copy Direct Link Button */}
              <button
                onClick={() => {
                  const url = `${window.location.origin}/quickdrop?room=${roomId}`;
                  navigator.clipboard.writeText(url);
                  setCopiedLink(true);
                  setTimeout(() => setCopiedLink(false), 2000);
                }}
                className="w-full mb-4 py-2 px-3 rounded-xl border border-border bg-background hover:bg-muted text-xs font-semibold text-foreground flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Share2 className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Link Copied!' : 'Copy Direct Link'}</span>
              </button>

              {/* Connect to Another Room Input */}
              <div className="pt-3 border-t border-border">
                {notice && <p className="mb-2 text-xs text-amber-600 dark:text-amber-400">{notice}</p>}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter 6-digit PIN..."
                    inputMode="numeric"
                    maxLength={7}
                    onKeyDown={(e) => { if (e.key === 'Enter') connectToRoomCode(targetRoomInput); }}
                    value={targetRoomInput}
                    onChange={(e) => setTargetRoomInput(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-hidden focus:ring-2 focus:ring-primary font-mono"
                  />
                  <button
                    onClick={() => connectToRoomCode(targetRoomInput)}
                    disabled={!targetRoomInput.trim()}
                    className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    Connect
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 8. TEXT NOTE MODAL */}
        {showTextModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-3xl max-w-md w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
              <button
                onClick={() => setShowTextModal(false)}
                className="absolute right-4 top-4 p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <h3 className="text-lg font-bold text-foreground mb-1">Send Text or Link</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Beam copied links, notes, or code to another device.
              </p>

              {radar.length > 1 && (
                <div className="flex flex-wrap gap-2 mb-3" role="radiogroup" aria-label="Send to">
                  {radar.map(({ info }) => (
                    <button
                      key={info.id}
                      type="button"
                      role="radio"
                      aria-checked={textTarget === info.id}
                      onClick={() => setTextTarget(info.id)}
                      className={`px-3 py-1 rounded-full border text-xs font-semibold cursor-pointer transition-colors ${textTarget === info.id ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted'}`}
                    >
                      {info.name}
                    </button>
                  ))}
                </div>
              )}
              {radar.length === 0 && (
                <p className="text-xs text-amber-700 dark:text-amber-400 mb-3">No device yet: open QuickDrop on the other device first.</p>
              )}

              <textarea
                rows={4}
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Paste URLs or notes here..."
                className="w-full p-3 text-sm rounded-xl border border-border bg-background focus:outline-hidden focus:ring-2 focus:ring-primary mb-4"
              />

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowTextModal(false)}
                  className="px-4 py-2 rounded-xl border border-border text-xs font-semibold hover:bg-muted transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendTextMessage}
                  disabled={!textInput.trim()}
                  className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 disabled:opacity-50 transition-all cursor-pointer"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </ToolLayout>
  );
}
