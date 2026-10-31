import type { Metadata } from 'next';
import { generateToolMetadata } from '@/config/seo';
import CurlTesterClient from './CurlTesterClient';
export const metadata: Metadata = generateToolMetadata('curl-tester');
export default function CurlTesterPage() { return <CurlTesterClient />; }

