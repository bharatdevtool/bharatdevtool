import type { Metadata } from 'next';
import { generateToolMetadata } from '@/config/seo';
import PdfToolClient from '@/components/pdf/PdfToolClient';

export const metadata: Metadata = generateToolMetadata('edit-pdf');

export default function EditPdfPage() {
  return <PdfToolClient initialTask="edit" />;
}
