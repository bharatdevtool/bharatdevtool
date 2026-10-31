import type { Metadata } from 'next';
import { generateToolMetadata } from '@/config/seo';
import JsonDiffClient from './JsonDiffClient';

export const metadata: Metadata = generateToolMetadata('json-diff');

export default function JsonDiffPage() {
  return <JsonDiffClient />;
}
