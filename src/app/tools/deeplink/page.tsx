import type { Metadata } from 'next';
import { generateToolMetadata } from '@/config/seo';
import DeepLinkClient from './DeepLinkClient';
export const metadata: Metadata = generateToolMetadata('deeplink');
export default function DeepLinkPage() { return <DeepLinkClient />; }

