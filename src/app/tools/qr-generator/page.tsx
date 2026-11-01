import type { Metadata } from 'next';
import { generateToolMetadata } from '@/config/seo';
import QrGeneratorClient from './QrGeneratorClient';

export const metadata: Metadata = generateToolMetadata('qr-generator');

export default function QrGeneratorPage() {
  return <QrGeneratorClient />;
}
