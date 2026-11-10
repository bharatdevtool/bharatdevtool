import type { Metadata } from 'next';
import { generateToolMetadata } from '@/config/seo';
import PdfToolClient from '@/components/pdf/PdfToolClient';

export const metadata: Metadata = generateToolMetadata('watermark-pdf');

export default function WatermarkPdfPage() {
  return <PdfToolClient initialTask="watermark" />;
}
