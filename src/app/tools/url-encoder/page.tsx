import type { Metadata } from 'next';
import { generateToolMetadata } from '@/config/seo';
import UrlEncoderClient from './UrlEncoderClient';
export const metadata: Metadata = generateToolMetadata('url-encoder');
export default function UrlEncoderPage() { return <UrlEncoderClient />; }

