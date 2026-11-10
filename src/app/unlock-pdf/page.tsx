import type { Metadata } from 'next';
import { generateToolMetadata } from '@/config/seo';
import PdfToolClient from '@/components/pdf/PdfToolClient';

export const metadata: Metadata = generateToolMetadata('unlock-pdf');

export default function UnlockPdfPage() {
  return <PdfToolClient initialTask="unlock" />;
}
