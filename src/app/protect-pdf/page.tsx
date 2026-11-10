import type { Metadata } from 'next';
import { generateToolMetadata } from '@/config/seo';
import PdfToolClient from '@/components/pdf/PdfToolClient';

export const metadata: Metadata = generateToolMetadata('protect-pdf');

export default function ProtectPdfPage() {
  return <PdfToolClient initialTask="protect" />;
}
