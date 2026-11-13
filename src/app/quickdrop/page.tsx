import type { Metadata } from 'next';
import { generateToolMetadata } from '@/config/seo';
import QuickDropClient from './QuickDropClient';

export const metadata: Metadata = generateToolMetadata('quickdrop');

export default function QuickDropPage() {
  return <QuickDropClient />;
}

