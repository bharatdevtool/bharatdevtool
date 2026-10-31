import type { Metadata } from 'next';
import { generateToolMetadata } from '@/config/seo';
import TextCaseConverterClient from './TextCaseConverterClient';
export const metadata: Metadata = generateToolMetadata('text-case-converter');
export default function TextCaseConverterPage() { return <TextCaseConverterClient />; }

