import type { Metadata } from 'next';
import { generateToolMetadata } from '@/config/seo';
import PdfToolClient from '@/components/pdf/PdfToolClient';

export const metadata: Metadata = generateToolMetadata('split-pdf');

export default function SplitPdfPage() {
  return <PdfToolClient initialTask="split" />;
}
