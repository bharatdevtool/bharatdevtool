import type { Metadata } from 'next';
import { generateToolMetadata } from '@/config/seo';
import UUIDGeneratorClient from './UUIDGeneratorClient';
export const metadata: Metadata = generateToolMetadata('uuid-generator');
export default function UUIDGeneratorPage() { return <UUIDGeneratorClient />; }

