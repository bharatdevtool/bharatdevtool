'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import { TOOLS } from '@/config/tools';

// Next.js tool pages (clean paths like /compress-pdf); static HTML pages track themselves in header.js.
const NEXT_TOOL_ROUTES = TOOLS.filter((t) => !t.legacy).map((t) => t.route);
const ONE_YEAR = 31536000;

function rememberLastTool(pathname: string) {
  const path = pathname.replace(/\/$/, '');
  try {
    document.cookie = `bdt_visited=1;path=/;max-age=${ONE_YEAR};SameSite=Lax`;
    // Only real tool pages: not 404s, the /open viewer or OG images.
    if (NEXT_TOOL_ROUTES.includes(path)) {
      document.cookie = `bdt_last_tool=${encodeURIComponent(path)};path=/;max-age=${ONE_YEAR};SameSite=Lax`;
    }
  } catch {
    /* cookies blocked */
  }
}

/** True once, right after the homepage sent this tab here automatically. */
function takeAutoOpenNote(): boolean {
  try {
    if (sessionStorage.getItem('bdt_auto_note') !== '1') return false;
    sessionStorage.removeItem('bdt_auto_note');
    return true;
  } catch {
    return false;
  }
}

/**
 * Remembers the last tool used (bdt_last_tool cookie), so the homepage can send
 * typed/bookmarked visits back to it. After such an automatic jump, shows a
 * one-time line with a way back to the full tool directory.
 */
export default function LastToolTracker() {
  const pathname = usePathname();
  const [showNote, setShowNote] = useState(false);

  useEffect(() => {
    rememberLastTool(pathname);
  }, [pathname]);

  useEffect(() => {
    // Reads sessionStorage, which only exists in the browser: must run after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (takeAutoOpenNote()) setShowNote(true);
  }, []);

  if (!showNote) return null;
  return (
    <p className="m-0 flex items-center justify-center gap-2 px-4 pb-1.5 text-center text-xs sm:text-[13px] text-slate-600 dark:text-slate-400">
      <span>Opened the tool you used last.</span>
      {/* Plain link: / is a static HTML page. "?all" keeps it from redirecting back here. */}
      <a href="/?all" className="font-semibold text-blue-600 hover:underline dark:text-blue-300">
        See all tools →
      </a>
      <button
        type="button"
        onClick={() => setShowNote(false)}
        aria-label="Dismiss"
        className="rounded p-0.5 hover:bg-slate-200 dark:hover:bg-slate-800"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </p>
  );
}
