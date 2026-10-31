import type { Metadata } from 'next';
import { generateToolMetadata } from '@/config/seo';
import WhatsAppLinkClient from './WhatsAppLinkClient';
export const metadata: Metadata = generateToolMetadata('whatsapp-link');
export default function WhatsAppLinkPage() { return <WhatsAppLinkClient />; }

