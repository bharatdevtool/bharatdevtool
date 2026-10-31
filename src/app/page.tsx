import { redirect } from 'next/navigation';

// Home page redirects to the flagship JSON Formatter tool
export default function Home() {
  redirect('/tools/json-formatter');
}
