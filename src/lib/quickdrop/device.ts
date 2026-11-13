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
  if (/iPad|tablet/i.test(ua)) {
    type = 'tablet';
  } else if (/Mobi|Android|iPhone/i.test(ua)) {
    type = 'mobile';
  }

  let os = 'Unknown OS';
  if (/Mac/i.test(ua)) os = 'macOS';
  else if (/Win/i.test(ua)) os = 'Windows';
  else if (/Linux/i.test(ua)) os = 'Linux';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';

  let browser = 'Browser';
  if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) browser = 'Chrome';
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
  else if (/Firefox/i.test(ua)) browser = 'Firefox';
  else if (/Edg/i.test(ua)) browser = 'Edge';

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

