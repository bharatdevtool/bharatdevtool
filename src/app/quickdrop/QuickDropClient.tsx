'use client';
/* eslint-disable react-hooks/purity -- Date.now()/Math.random() run only inside peer and click handlers, never during render. */

import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { motion, AnimatePresence } from 'framer-motion';
import type { DataConnection, Peer as PeerType } from 'peerjs';
import {
  Smartphone,
  Laptop,
  Monitor,
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
} from 'lucide-react';
import ToolLayout from '@/components/layout/ToolLayout';
import { detectDevice, formatBytes } from '@/lib/quickdrop/device';
import { sliceAndSendFile, type ProtocolMessage } from '@/lib/quickdrop/protocol';
import type { DeviceInfo, TransferProgress, TextMessage } from '@/lib/quickdrop/types';

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
  const [, setPeerStatus] = useState<'initializing' | 'ready' | 'connecting' | 'error'>('initializing');
  const [connectedPeers, setConnectedPeers] = useState<Map<string, { info: DeviceInfo; conn: DataConnection }>>(new Map());
  const [selectedPeerId, setSelectedPeerId] = useState<string | null>(null);

  // Transfers & Messages
  const [activeTransfers, setActiveTransfers] = useState<TransferProgress[]>([]);
  const [receivedFiles, setReceivedFiles] = useState<TransferProgress[]>([]);
  const [messages, setMessages] = useState<TextMessage[]>([]);
  const [textInput, setTextInput] = useState<string>('');

  // Modals & UI States
  const [showPairModal, setShowPairModal] = useState<boolean>(false);
  const [showTextModal, setShowTextModal] = useState<boolean>(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [isDragOverStage, setIsDragOverStage] = useState<boolean>(false);
  // Devices that connected to us and wait for "Allow" (outgoing connections are trusted).
  const [pendingRequests, setPendingRequests] = useState<{ info: DeviceInfo; conn: DataConnection }[]>([]);
  const [notice, setNotice] = useState<string>('');
  const [dragOverPeerId, setDragOverPeerId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const targetPeerForFileRef = useRef<string | null>(null);
  const peerInstanceRef = useRef<PeerType | null>(null);
  const incomingChunksRef = useRef<Map<string, { chunks: ArrayBuffer[]; total: number; name: string; type: string; size: number }>>(new Map());
  const transferStatsRef = useRef<Map<string, { lastBytes: number; lastTime: number; speed: number }>>(new Map());
  const deviceRef = useRef<DeviceInfo>(device);
  const approvedRef = useRef<Set<DataConnection>>(new Set()); // connections allowed to send data
  const handlersRef = useRef<{ setup: (conn: DataConnection, outgoing: boolean) => void; connect: (code: string) => void } | null>(null);
  const receivedBytesRef = useRef<Map<string, number>>(new Map());

  // 1. Initialize Device & Room Code
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

    async function initPeer() {
      try {
        const { default: Peer } = await import('peerjs');
        // This device's PIN IS its peer ID, so "enter PIN" and "scan QR" reach exactly this device.
        const myRoom = Math.floor(100000 + Math.random() * 900000).toString();
        const peerId = `bdt-qd-${myRoom}`;
        attempts += 1;

        const peer = new Peer(peerId, {
          debug: 1,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' },
            ],
          },
        });

        peerInstanceRef.current = peer;

        peer.on('open', (id) => {
          if (!isMounted) return;
          setRoomId(myRoom);
          setDevice((prev) => ({ ...prev, id }));
          setPeerStatus('ready');
          if (joinPin && joinPin !== myRoom) handlersRef.current?.connect(joinPin);
          joinPin = null;

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

        peer.on('error', (err: { type?: string }) => {
          if (!isMounted) return;
          if (err?.type === 'unavailable-id' && attempts < 5) {
            // PIN already taken by another device: pick a new one.
            peer.destroy();
            initPeer();
            return;
          }
          if (err?.type === 'peer-unavailable') {
            setNotice('No device found with that PIN. Check the PIN and keep QuickDrop open on the other device.');
            setPeerStatus('ready');
            return;
          }
          console.warn('[QuickDrop] Peer error:', err?.type);
          setPeerStatus('error');
          setNotice('Could not reach the pairing service. Check your internet connection and reload.');
        });
      } catch (err) {
        console.error('[QuickDrop] Failed to initialize peer:', err);
        if (isMounted) setPeerStatus('error');
      }
    }

    initPeer();

    return () => {
      isMounted = false;
      if (peerInstanceRef.current) {
        peerInstanceRef.current.destroy();
      }
    };
  }, []);

  function setupConnectionListeners(conn: DataConnection, outgoing: boolean) {
    // We chose to connect to this device (its PIN or QR), so we trust it; incoming ones need "Allow".
    if (outgoing) approvedRef.current.add(conn);

    conn.on('open', () => {
      conn.send({
        type: 'HANDSHAKE',
        device: deviceRef.current,
      });
    });

    conn.on('data', (data: unknown) => {
      handleIncomingData(conn, data as ProtocolMessage);
    });

    conn.on('close', () => {
      approvedRef.current.delete(conn);
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
      next.set(conn.peer, { info, conn });
      return next;
    });
    setSelectedPeerId((prev) => prev || conn.peer);
  }

  function allowRequest(conn: DataConnection) {
    const req = pendingRequests.find((r) => r.conn === conn);
    setPendingRequests((prev) => prev.filter((r) => r.conn !== conn));
    if (!req || !conn.open) return;
    approvedRef.current.add(conn);
    addPeer(conn, req.info);
  }

  function declineRequest(conn: DataConnection) {
    setPendingRequests((prev) => prev.filter((r) => r.conn !== conn));
    try { conn.close(); } catch {}
  }

  function handleIncomingData(conn: DataConnection, data: ProtocolMessage) {
    if (!data || !data.type) return;
    // Only HANDSHAKE until the user allows this device: nothing else may arrive unasked.
    if (data.type !== 'HANDSHAKE' && !approvedRef.current.has(conn)) return;

    switch (data.type) {
      case 'HANDSHAKE': {
        const d: Partial<DeviceInfo> = data.device || {};
        const types = ['mobile', 'tablet', 'desktop'];
        const peerInfo: DeviceInfo = {
          id: conn.peer,
          name: String(d.name || 'Device').slice(0, 40),
          type: (types.includes(d.type as string) ? d.type : 'desktop') as DeviceInfo['type'],
          os: String(d.os || '').slice(0, 20),
          browser: String(d.browser || '').slice(0, 20),
        };
        if (approvedRef.current.has(conn)) addPeer(conn, peerInfo);
        else setPendingRequests((prev) => [...prev.filter((r) => r.conn !== conn), { info: peerInfo, conn }]);
        break;
      }

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
    setPeerStatus('connecting');
    const targetPeerId = `bdt-qd-${cleanCode}`;
    const conn = peerInstanceRef.current.connect(targetPeerId, { reliable: true });

    if (conn) {
      setupConnectionListeners(conn, true);
      setShowPairModal(false);
      setTargetRoomInput('');
      setPeerStatus('ready');
    }
  }

  async function handleSendFiles(files: FileList | File[], specificPeerId?: string) {
    const targetId = specificPeerId || selectedPeerId;
    const activePeer = targetId ? connectedPeers.get(targetId) : Array.from(connectedPeers.values())[0];

    if (!activePeer || !activePeer.conn) {
      setShowPairModal(true);
      return;
    }

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
            const conn = activePeer.conn;
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

  function handleSendTextMessage() {
    if (!textInput.trim()) return;
    const activePeer = selectedPeerId ? connectedPeers.get(selectedPeerId) : Array.from(connectedPeers.values())[0];
    if (!activePeer) {
      setShowPairModal(true);
      return;
    }

    const msg: TextMessage = {
      id: `${Date.now()}`,
      senderName: device.name,
      text: textInput.trim(),
      timestamp: Date.now(),
    };

    activePeer.conn.send({
      type: 'TEXT_MESSAGE',
      message: msg,
    });

    setMessages((prev) => [msg, ...prev]);
    setTextInput('');
    setShowTextModal(false);
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

  const peerList = Array.from(connectedPeers.values());

  // Peer callbacks are registered once; they call the latest handlers through this ref.
  useEffect(() => {
    handlersRef.current = { setup: setupConnectionListeners, connect: connectToRoomCode };
  });

  return (
    <ToolLayout toolId="quickdrop">
      <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-2">

        {pendingRequests.map((req) => (
          <div key={req.conn.connectionId || req.conn.peer} role="alert" className="mb-3 flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-blue-500/40 bg-blue-500/10 px-4 py-3 text-sm">
            <span className="flex-1">
              <strong>{req.info.name}</strong>
              {req.info.os ? ` (${req.info.os}${req.info.browser ? ', ' + req.info.browser : ''})` : ''} wants to connect. Allow it to send you files and messages?
            </span>
            <div className="flex gap-2">
              <button type="button" onClick={() => allowRequest(req.conn)} className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 cursor-pointer">Allow</button>
              <button type="button" onClick={() => declineRequest(req.conn)} className="px-4 py-1.5 rounded-lg border border-border text-xs font-bold hover:bg-muted cursor-pointer">Decline</button>
            </div>
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
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Online
              </span>
              <span className="text-muted-foreground text-xs font-mono">
                PIN: <strong className="text-foreground tracking-wider font-bold">{roomId}</strong>
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(roomId);
                  setCopiedCode(true);
                  setTimeout(() => setCopiedCode(false), 2000);
                }}
                className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground transition-colors ml-0.5 cursor-pointer"
                title="Copy Room PIN"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowPairModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 active:scale-95 transition-all cursor-pointer shadow-xs"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Pair Device</span>
            </button>
            <button
              onClick={() => setShowTextModal(true)}
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
              onClick={() => {
                if (peerList.length > 0) {
                  triggerPeerFileSelect(peerList[0].info.id);
                } else {
                  setShowPairModal(true);
                }
              }}
              title="Click to pair or send files"
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
                Broadcasting availability nearby
              </span>
            </div>

            {/* NEARBY DISCOVERED PEERS (DYNAMICALLY POSITIONED ON RIPPLE WAVES AWAY FROM CENTER) */}
            <AnimatePresence>
              {peerList.map(({ info }, idx) => {
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
                        {getDeviceIcon(info.type, 'w-7 h-7 text-foreground group-hover:text-primary transition-colors')}
                        <span className="absolute -top-1 -right-1 flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                        </span>
                      </div>

                      <div className="mt-1.5 text-center px-2 py-0.5 rounded-full bg-background/85 backdrop-blur-xs border border-border/50 shadow-2xs">
                        <span className="text-xs font-bold text-foreground block truncate max-w-[100px]">
                          {info.name}
                        </span>
                        <span className="text-[10px] text-muted-foreground block">
                          {info.os}
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
            {peerList.length > 0 ? 'Ready to share?' : 'Ready to share?'}
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-md">
            Open QuickDrop on another device using the same Wi-Fi network.
          </p>

          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={() => setShowPairModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs sm:text-sm font-semibold hover:opacity-90 active:scale-95 transition-all shadow-md shadow-primary/20 cursor-pointer"
            >
              <QrCode className="w-4 h-4" />
              <span>Show QR Code &amp; PIN</span>
            </button>

            <button
              onClick={() => {
                if (fileInputRef.current) fileInputRef.current.click();
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border bg-background hover:bg-muted text-foreground text-xs sm:text-sm font-medium transition-all active:scale-95 cursor-pointer"
            >
              <FileUp className="w-4 h-4 text-muted-foreground" />
              <span>Select Files</span>
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
                <h3 className="text-lg font-bold text-foreground">Pair Device</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Scan QR code or enter your 6-digit room PIN.
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
                Beam copied links, notes, or code to connected devices.
              </p>

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
