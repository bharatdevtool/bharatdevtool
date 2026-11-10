'use client';

import React from 'react';

export interface TabOption<T extends string = string> {
  id: T;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
}

interface SegmentedTabsProps<T extends string = string> {
  tabs: TabOption<T>[];
  activeTab: T;
  onChange: (tabId: T) => void;
  className?: string;
  size?: 'sm' | 'md';
}

export default function SegmentedTabs<T extends string = string>({
  tabs,
  activeTab,
  onChange,
  className = '',
  size = 'md',
}: SegmentedTabsProps<T>) {
  const sizeClasses = size === 'sm' ? 'p-1 text-xs gap-1' : 'p-1 text-xs sm:text-sm gap-1';
  const itemPadding = size === 'sm' ? 'px-2.5 py-1' : 'px-3.5 py-1.5';

  return (
    <div
      role="tablist"
      className={`inline-flex items-center rounded-lg border border-border/80 bg-muted/60 backdrop-blur-xs select-none max-w-full overflow-x-auto ${sizeClasses} ${className}`}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-all duration-150 shrink-0 ${itemPadding} ${
              isActive
                ? 'bg-card text-foreground shadow-xs border border-border/50 font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-card/40'
            }`}
          >
            {tab.icon && <span className="w-3.5 h-3.5">{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-muted border border-border text-muted-foreground">
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

