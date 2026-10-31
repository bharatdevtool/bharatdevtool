'use client';

import React from 'react';
import { AlertCircle, X } from 'lucide-react';

interface ErrorMessageProps {
  message: string;
  onDismiss?: () => void;
  className?: string;
}

export default function ErrorMessage({ message, onDismiss, className = '' }: ErrorMessageProps) {
  if (!message) return null;

  return (
    <div
      role="alert"
      className={`flex items-start justify-between gap-3 p-3.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 text-xs sm:text-sm animate-in fade-in duration-150 ${className}`}
    >
      <div className="flex items-start gap-2.5">
        <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
        <div className="font-mono text-xs leading-relaxed break-words">{message}</div>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="p-1 rounded-md text-red-500/70 hover:text-red-500 hover:bg-red-500/10 transition-colors"
          aria-label="Dismiss error"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
