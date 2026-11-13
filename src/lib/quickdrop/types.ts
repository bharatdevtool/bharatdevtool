export interface DeviceInfo {
  id: string;
  name: string;
  type: 'mobile' | 'tablet' | 'desktop';
  os: string;
  browser: string;
}

export interface TransferProgress {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  bytesTransferred: number;
  progress: number; // 0 to 100
  speed: number; // bytes per second
  direction: 'sending' | 'receiving';
  status: 'pending' | 'transferring' | 'completed' | 'error' | 'cancelled';
  blob?: Blob;
  downloadUrl?: string;
  error?: string;
}

export interface TextMessage {
  id: string;
  senderName: string;
  text: string;
  timestamp: number;
}

