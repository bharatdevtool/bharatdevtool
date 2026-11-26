import type { Metadata } from 'next';
import { generateToolMetadata } from '@/config/seo';
import IdCardPrintClient from './IdCardPrintClient';

export const metadata: Metadata = generateToolMetadata('aadhaar-card-print');

export default function AadhaarCardPrintPage() {
  return <IdCardPrintClient />;
}
