import type { DeviceInfo } from './types';

const ADJECTIVES = [
  'Swift', 'Brave', 'Golden', 'Silver', 'Crimson', 'Emerald',
  'Sapphire', 'Royal', 'Silent', 'Mighty', 'Bright', 'Calm',
  'Amber', 'Coral', 'Azure', 'Cosmic', 'Solar', 'Lunar'
];

const ANIMALS = [
  'Falcon', 'Tiger', 'Peacock', 'Lion', 'Elephant', 'Eagle',
  'Leopard', 'Cheetah', 'Otter', 'Panda', 'Dolphin', 'Wolf',
  'Fox', 'Hawk', 'Badger', 'Lynx', 'Stag', 'Swan'
];

export function generateDeviceName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  return `${adj} ${animal}`;
}

export function detectDevice(): DeviceInfo {
  if (typeof window === 'undefined') {
    return {
      id: '',
      name: 'Unknown Device',
      type: 'desktop',
      os: 'Unknown',
      browser: 'Unknown',
    };
  }

  const ua = navigator.userAgent;
  let type: 'mobile' | 'tablet' | 'desktop' = 'desktop';
  // iPadOS Safari reports itself as a Mac; only the touch screen gives it away.
  if (/iPad|tablet/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) {
    type = 'tablet';
  } else if (/Mobi|Android|iPhone/i.test(ua)) {
    type = 'mobile';
  }

  // iPhone user agents say "like Mac OS X" and Android ones say "Linux": test those first.
  let os = 'Unknown OS';
  if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/Mac/i.test(ua)) os = navigator.maxTouchPoints > 1 ? 'iPadOS' : 'macOS';
  else if (/Win/i.test(ua)) os = 'Windows';
  else if (/CrOS/i.test(ua)) os = 'ChromeOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  let browser = 'Browser';
  if (/Edg/i.test(ua)) browser = 'Edge';
  else if (/Chrome|CriOS/i.test(ua)) browser = 'Chrome';
  else if (/Firefox|FxiOS/i.test(ua)) browser = 'Firefox';
  else if (/Safari/i.test(ua)) browser = 'Safari';

  // Persistent device name in localStorage
  let savedName = '';
  try {
    savedName = localStorage.getItem('bdt_qd_name') || '';
    if (!savedName) {
      savedName = generateDeviceName();
      localStorage.setItem('bdt_qd_name', savedName);
    }
  } catch {
    savedName = generateDeviceName();
  }

  return {
    id: '',
    name: savedName,
    type,
    os,
    browser,
  };
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

