import React from 'react';
import {
  Braces,
  GitCompare,
  QrCode,
  ScanLine,
  Palette,
  Sparkles,
  Terminal,
  ArrowLeftRight,
  ExternalLink,
  Binary,
  Link2,
  Regex,
  Zap,
  BookOpen,
  FileText,
  CaseSensitive,
  KeyRound,
  Fingerprint,
  MessageSquare,
  Calendar,
  Wrench,
  Film,
  SlidersHorizontal,
  ShieldCheck,
  Gauge,
  Code2,
  FolderArchive,
  type LucideIcon,
} from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  'json-formatter': Braces,
  'json-diff': GitCompare,
  'qr-generator': QrCode,
  'qr-decoder': ScanLine,
  'color-picker': Palette,
  'gradient-generator': Sparkles,
  'curl-tester': Terminal,
  'curl-comparison': ArrowLeftRight,
  deeplink: ExternalLink,
  base64: Binary,
  'url-encoder': Link2,
  'regex-tester': Regex,
  'regex-generator': Zap,
  'regex-library': BookOpen,
  'word-counter': FileText,
  'text-case-converter': CaseSensitive,
  'password-generator': KeyRound,
  'uuid-generator': Fingerprint,
  'whatsapp-link': MessageSquare,
  'age-calculator': Calendar,
  'lottie-player': Film,
  'lottie-analyzer': SlidersHorizontal,
  'lottie-validator': ShieldCheck,
  'lottie-optimizer': Gauge,
  'lottie-editor': Code2,
  'lottie-converter': FolderArchive,
};

interface ToolIconProps {
  toolId: string;
  className?: string;
  size?: number;
}

export default function ToolIcon({ toolId, className = 'w-5 h-5', size }: ToolIconProps) {
  const IconComponent = ICON_MAP[toolId] || Wrench;
  return <IconComponent className={className} size={size} aria-hidden="true" />;
}

