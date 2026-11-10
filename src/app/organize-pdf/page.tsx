import type { Metadata } from 'next';
import { generateToolMetadata } from '@/config/seo';
import PdfToolClient from '@/components/pdf/PdfToolClient';

export const metadata: Metadata = generateToolMetadata('organize-pdf');

export default function OrganizePdfPage() {
  return <PdfToolClient initialTask="organize" />;
}
