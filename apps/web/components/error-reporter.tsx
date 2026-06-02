'use client';

import { Component, useEffect, type PropsWithChildren, type ReactNode } from 'react';

// ─── Global error / rejection listener ──────────────────────────────────────

let _installed = false;

function reportError(payload: {
  message: string;
  stack?: string;
  source: string;
  componentStack?: string;
  extra?: string;
}) {
  try {
    const body = {
      ...payload,
      url: typeof window !== 'undefined' ? window.location.href : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    };
    // Use sendBeacon for reliability (works even during page unload)
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon('/api/error-report', JSON.stringify(body));
    } else {
      fetch('/api/error-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // Swallow — the reporter must never throw
  }
}

/**
 * Installs global window.onerror + unhandledrejection listeners.
 * Renders nothing — just a hook that runs once.
 */
export function GlobalErrorListener() {
  useEffect(() => {
    if (_installed) return;
    _installed = true;

    const handleError = (event: ErrorEvent) => {
      reportError({
        message: event.message ?? String(event.error),
        stack: event.error?.stack,
        source: 'client',
        extra: event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : undefined,
      });
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const err = event.reason;
      reportError({
        message: err?.message ?? String(err),
        stack: err?.stack,
        source: 'unhandledrejection',
      });
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
      _installed = false;
    };
  }, []);

  return null;
}

// ─── React Error Boundary ───────────────────────────────────────────────────

interface ErrorBoundaryLabels {
  title: string;
  message: string;
  reload: string;
}

interface ErrorBoundaryProps extends PropsWithChildren {
  fallback?: ReactNode;
  /** i18n labels passed from parent — class components cannot use hooks. */
  labels?: ErrorBoundaryLabels;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Catches React render errors, reports them to the API, and shows a
 * branded fallback instead of a white screen.
 *
 * i18n: pass `labels` prop from the parent that has access to
 * `useTranslations` / `getTranslations`. Class components cannot
 * call hooks, so labels must be injected.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    reportError({
      message: error.message,
      stack: error.stack,
      source: 'client',
      componentStack: info.componentStack ?? undefined,
    });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      const labels = this.props.labels ?? {
        title: 'Error',
        message: 'An error has been reported.',
        reload: 'Reload',
      };
      return (
        <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-8">
          <p className="text-sm font-semibold text-rose-700">{labels.title}</p>
          <p className="text-xs text-rose-600">{labels.message}</p>
          <button
            type="button"
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            className="rounded-lg border border-rose-300 bg-white px-4 py-2 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-50"
          >
            {labels.reload}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
