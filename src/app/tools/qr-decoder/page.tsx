import type { Metadata } from 'next';
import { generateToolMetadata } from '@/config/seo';
import QrDecoderClient from './QrDecoderClient';

export const metadata: Metadata = generateToolMetadata('qr-decoder');

export default function QrDecoderPage() {
  return <QrDecoderClient />;
}
