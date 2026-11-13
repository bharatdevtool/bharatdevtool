import type { DeviceInfo, TextMessage } from './types';

export const CHUNK_SIZE = 64 * 1024; // 64 KB per WebRTC message

export type ProtocolMessage =
  | { type: 'HANDSHAKE'; device: DeviceInfo }
  | { type: 'FILE_HEADER'; fileId: string; name: string; size: number; mimeType: string; totalChunks: number }
  | { type: 'FILE_CHUNK'; fileId: string; chunkIndex: number; data: ArrayBuffer }
  | { type: 'FILE_COMPLETE'; fileId: string }
  | { type: 'FILE_CANCEL'; fileId: string }
  | { type: 'TEXT_MESSAGE'; message: TextMessage }
  | { type: 'PING' }
  | { type: 'PONG' };

export async function sliceAndSendFile(
  file: File,
  fileId: string,
  sendFn: (msg: ProtocolMessage) => Promise<void> | void,
  onProgress?: (sentBytes: number, totalBytes: number) => void
): Promise<void> {
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

  // Send header
  sendFn({
    type: 'FILE_HEADER',
    fileId,
    name: file.name,
    size: file.size,
    mimeType: file.type || 'application/octet-stream',
    totalChunks,
  });

  let offset = 0;
  for (let i = 0; i < totalChunks; i++) {
    const slice = file.slice(offset, offset + CHUNK_SIZE);
    const buffer = await slice.arrayBuffer();

    sendFn({
      type: 'FILE_CHUNK',
      fileId,
      chunkIndex: i,
      data: buffer,
    });

    offset += CHUNK_SIZE;
    if (onProgress) {
      onProgress(Math.min(offset, file.size), file.size);
    }

    // Small yield every 8 chunks to keep event loop free for UI updates and buffer backpressure
    if (i % 8 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  }

  // Send complete
  sendFn({
    type: 'FILE_COMPLETE',
    fileId,
  });
}

