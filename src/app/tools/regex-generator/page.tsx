import type { Metadata } from 'next';
import { generateToolMetadata } from '@/config/seo';
import RegexGeneratorClient from './RegexGeneratorClient';
export const metadata: Metadata = generateToolMetadata('regex-generator');
export default function RegexGeneratorPage() { return <RegexGeneratorClient />; }

