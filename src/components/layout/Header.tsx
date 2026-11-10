'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Search, Sun, Moon, Sparkles, ShieldCheck } from 'lucide-react';
import { SITE } from '@/config/site';
import { useTheme } from '@/hooks/useTheme';
import { analytics } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/config/site';
import CommandPalette from '@/components/ui/CommandPalette';

export default function Header() {
  const { isDark, toggleTheme } = useTheme();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const pathname = usePathname();

  function handleThemeToggle() {
    toggleTheme();
    analytics.track(ANALYTICS_EVENTS.THEME_TOGGLE, { theme: isDark ? 'light' : 'dark' });
  }

  // Keyboard shortcut for Cmd+K / Ctrl+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-border/70 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          {/* Logo + Name */}
          <div className="flex items-center gap-6">
            <Link href="/tools.html" className="flex items-center gap-2.5 group">
              <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 group-hover:border-primary/40 transition-colors">
                <Image
                  src={SITE.logoUrl}
                  alt={SITE.logoAlt}
                  width={24}
                  height={24}
                  className="rounded"
                  priority
                />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold tracking-tight text-foreground group-hover:text-primary transition-colors">
                  {SITE.name}
                </span>
                <span className="hidden lg:inline text-[10px] text-muted-foreground flex items-center gap-1 font-mono">
                  <ShieldCheck className="w-3 h-3 text-emerald-500 inline" /> 100% Client-Side
                </span>
              </div>
            </Link>

            {/* Quick search button */}
            <button
              onClick={() => setIsSearchOpen(true)}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-muted/40 hover:bg-muted/70 text-xs text-muted-foreground hover:text-foreground transition-all w-56 md:w-64 justify-between"
              aria-label="Search tools"
            >
              <span className="flex items-center gap-2">
                <Search className="w-3.5 h-3.5" />
                <span>Search tools...</span>
              </span>
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-background border border-border text-muted-foreground shadow-2xs">
                ⌘K
              </kbd>
            </button>
          </div>

          {/* Nav & Actions */}
          <nav className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setIsSearchOpen(true)}
              className="sm:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              aria-label="Search tools"
            >
              <Search className="w-4 h-4" />
            </button>

            <Link
              href="/tools"
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                pathname === '/tools.html'
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
            >
              All Tools
            </Link>

            <Link
              href="/about.html"
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                pathname === '/about.html'
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
            >
              About
            </Link>

            {/* Theme toggle */}
            <button
              onClick={handleThemeToggle}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="ml-1 p-2 rounded-lg border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-700" />
              )}
            </button>
          </nav>
        </div>
      </header>

      {/* Global Command Palette */}
      <CommandPalette isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
}
