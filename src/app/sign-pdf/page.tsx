import type { Metadata } from 'next';
import { generateToolMetadata } from '@/config/seo';
import PdfToolClient from '@/components/pdf/PdfToolClient';

export const metadata: Metadata = generateToolMetadata('sign-pdf');

export default function SignPdfPage() {
  return <PdfToolClient initialTask="sign" />;
}
