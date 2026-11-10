import type { Metadata } from 'next';
import { generateToolMetadata } from '@/config/seo';
import PdfToolClient from '@/components/pdf/PdfToolClient';

export const metadata: Metadata = generateToolMetadata('jpg-to-pdf');

export default function JpgToPdfPage() {
  return <PdfToolClient initialTask="jpg-to-pdf" />;
}
