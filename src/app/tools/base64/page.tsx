import type { Metadata } from 'next';
import { generateToolMetadata } from '@/config/seo';
import Base64Client from './Base64Client';

export const metadata: Metadata = generateToolMetadata('base64');

export default function Base64Page() {
  return <Base64Client />;
}
