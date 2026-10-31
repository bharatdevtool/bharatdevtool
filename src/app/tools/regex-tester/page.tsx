import type { Metadata } from 'next';
import { generateToolMetadata } from '@/config/seo';
import RegexTesterClient from './RegexTesterClient';
export const metadata: Metadata = generateToolMetadata('regex-tester');
export default function RegexTesterPage() { return <RegexTesterClient />; }

