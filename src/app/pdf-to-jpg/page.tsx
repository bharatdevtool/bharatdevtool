import type { Metadata } from 'next';
import { generateToolMetadata } from '@/config/seo';
import PdfToolClient from '@/components/pdf/PdfToolClient';

export const metadata: Metadata = generateToolMetadata('pdf-to-jpg');

export default function PdfToJpgPage() {
  return <PdfToolClient initialTask="pdf-to-jpg" />;
}
