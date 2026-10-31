import type { Metadata } from 'next';
import { generateToolMetadata } from '@/config/seo';
import RegexLibraryClient from './RegexLibraryClient';
export const metadata: Metadata = generateToolMetadata('regex-library');
export default function RegexLibraryPage() { return <RegexLibraryClient />; }

