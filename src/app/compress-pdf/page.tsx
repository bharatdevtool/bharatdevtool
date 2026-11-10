import type { Metadata } from 'next';
import { generateToolMetadata } from '@/config/seo';
import PdfToolClient from '@/components/pdf/PdfToolClient';

export const metadata: Metadata = generateToolMetadata('compress-pdf');

export default function CompressPdfPage() {
  return <PdfToolClient initialTask="compress" />;
}
