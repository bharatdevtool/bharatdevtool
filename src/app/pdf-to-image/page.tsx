import type { Metadata } from 'next';
import { generateToolMetadata } from '@/config/seo';
import PdfToolClient from '@/components/pdf/PdfToolClient';

export const metadata: Metadata = generateToolMetadata('pdf-to-image');

export default function PdfToImagePage() {
  return <PdfToolClient initialTask="pdf-to-jpg" initialToolId="pdf-to-image" />;
}
