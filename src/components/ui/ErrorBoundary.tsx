'use client';

import React from 'react';
import { reportError } from '@/lib/monitoring/errorReporting';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/** Keeps a crashing tool from taking down the page and reports the error to Sentry */
export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    reportError(error, { contexts: { react: { componentStack: info.componentStack } } });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div role="alert" className="p-6 rounded-xl border border-destructive/30 bg-destructive/5 text-center space-y-3">
        <AlertTriangle className="w-6 h-6 text-destructive mx-auto" />
        <p className="text-sm font-semibold text-foreground">This tool ran into an unexpected error.</p>
        <p className="text-xs text-muted-foreground">Your data never left your browser. Try again, or reload the page.</p>
        <button
          type="button"
          onClick={() => this.setState({ hasError: false })}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Try again
        </button>
      </div>
    );
  }
}
