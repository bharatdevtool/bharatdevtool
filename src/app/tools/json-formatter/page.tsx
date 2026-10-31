import type { Metadata } from 'next';
import { generateToolMetadata } from '@/config/seo';
import JsonFormatterClient from './JsonFormatterClient';

export const metadata: Metadata = generateToolMetadata('json-formatter');

export default function JsonFormatterPage() {
  return <JsonFormatterClient />;
}
