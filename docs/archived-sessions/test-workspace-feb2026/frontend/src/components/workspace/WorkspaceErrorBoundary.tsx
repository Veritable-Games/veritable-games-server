'use client';

/**
 * Workspace Error Boundary
 *
 * React Error Boundary component to catch errors in workspace components
 * and prevent them from crashing the entire application.
 *
 * Features:
 * - Catches rendering errors in child components
 * - Displays fallback UI with error details (dev) or friendly message (prod)
 * - Provides "Reload Workspace" button to recover
 * - Logs errors to console for debugging
 * - Optional custom error handler for analytics/reporting
 *
 * Usage:
 * ```tsx
 * <WorkspaceErrorBoundary
 *   fallbackType="workspace"
 *   onError={(error, errorInfo) => {
 *     // Optional: Log to error tracking service
 *     logger.error('Workspace error:', error, errorInfo);
 *   }}
 * >
 *   <WorkspaceCanvas {...props} />
 * </WorkspaceErrorBoundary>
 * ```
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { logger } from '@/lib/utils/logger';

interface Props {
  children: ReactNode;
  /** Type of fallback UI to show */
  fallbackType?: 'workspace' | 'node' | 'connection' | 'minimal';
  /** Optional custom fallback component */
  fallback?: ReactNode;
  /** Optional error handler for logging/analytics */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Optional workspace ID for context */
  workspaceId?: string;
  /** Optional node ID for context (when wrapping single nodes) */
  nodeId?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorCount: number;
}

export class WorkspaceErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // FIX: Special handling for Yjs proxy errors during navigation
    // These are expected during rapid navigation and can be safely ignored
    const isYjsProxyError =
      error instanceof TypeError &&
      (error.message.includes('revoked') || error.message.includes('proxy'));

    const isNavigationError = isYjsProxyError && errorInfo.componentStack?.includes('Yjs');

    if (isNavigationError) {
      logger.warn(
        'Workspace Error Boundary caught Yjs navigation error (expected during cleanup):',
        {
          error: error.message,
          workspaceId: this.props.workspaceId,
        }
      );

      // For navigation errors, auto-recover instead of showing error UI
      // This provides seamless back button experience
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        errorCount: 0,
      });
      return;
    }

    // Log error details for non-navigation errors
    logger.error('Workspace Error Boundary caught an error:', {
      error,
      errorInfo,
      workspaceId: this.props.workspaceId,
      nodeId: this.props.nodeId,
      componentStack: errorInfo.componentStack,
    });

    // Update state with error info
    this.setState(prevState => ({
      errorInfo,
      errorCount: prevState.errorCount + 1,
    }));

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // In production, could send to error tracking service
    if (process.env.NODE_ENV === 'production') {
      // Example: Send to Sentry, LogRocket, etc.
      // trackError(error, { context: 'workspace', ...errorInfo });
    }
  }

  handleReload = () => {
    // Reset error state to retry rendering
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReloadPage = () => {
    // Full page reload as last resort
    window.location.reload();
  };

  renderFallback() {
    const { fallbackType = 'workspace', fallback } = this.props;
    const { error, errorInfo, errorCount } = this.state;

    // Use custom fallback if provided
    if (fallback) {
      return fallback;
    }

    // Common error message
    const errorMessage = error?.message || 'An unknown error occurred';
    const isDevelopment = process.env.NODE_ENV === 'development';

    // Workspace-level error (entire canvas crashed)
    if (fallbackType === 'workspace') {
      return (
        <div className="flex h-screen w-full items-center justify-center bg-neutral-900 p-8">
          <div className="max-w-2xl rounded-lg border border-red-900/50 bg-neutral-800 p-8 shadow-xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-900/20">
                <svg
                  className="h-6 w-6 text-red-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-neutral-100">Workspace Error</h2>
                <p className="text-sm text-neutral-400">
                  Something went wrong loading the workspace
                </p>
              </div>
            </div>

            {isDevelopment && (
              <div className="mb-4 rounded border border-red-900/50 bg-red-950/20 p-4">
                <p className="mb-2 font-mono text-sm text-red-300">{errorMessage}</p>
                {errorInfo?.componentStack && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm text-neutral-400 hover:text-neutral-300">
                      Component Stack
                    </summary>
                    <pre className="mt-2 max-h-40 overflow-auto text-xs text-neutral-500">
                      {errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            {!isDevelopment && (
              <p className="mb-4 text-neutral-300">
                The workspace encountered an error and couldn't load. This has been logged and we'll
                investigate.
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={this.handleReload}
                className="rounded bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700"
              >
                Try Again
              </button>
              {errorCount > 1 && (
                <button
                  onClick={this.handleReloadPage}
                  className="rounded border border-neutral-600 bg-neutral-700 px-4 py-2 font-medium text-neutral-200 transition-colors hover:bg-neutral-600"
                >
                  Reload Page
                </button>
              )}
            </div>

            {errorCount > 1 && (
              <p className="mt-4 text-sm text-neutral-400">
                Error occurred {errorCount} times. If the problem persists, try reloading the page.
              </p>
            )}
          </div>
        </div>
      );
    }

    // Node-level error (single node crashed)
    if (fallbackType === 'node') {
      return (
        <div
          className="flex min-h-[100px] items-center justify-center rounded border-2 border-dashed border-red-700/50 bg-red-950/20 p-4"
          style={{ minWidth: '200px' }}
        >
          <div className="text-center">
            <div className="mb-2 flex justify-center">
              <svg
                className="h-8 w-8 text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <p className="mb-2 text-sm font-medium text-red-300">Node Error</p>
            {isDevelopment && <p className="mb-3 text-xs text-neutral-400">{errorMessage}</p>}
            <button
              onClick={this.handleReload}
              className="rounded bg-red-700 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-red-600"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    // Connection-level error
    if (fallbackType === 'connection') {
      return (
        <div className="rounded border border-red-700/50 bg-red-950/20 p-3">
          <p className="text-sm text-red-300">Connection error</p>
          {isDevelopment && <p className="text-xs text-neutral-400">{errorMessage}</p>}
        </div>
      );
    }

    // Minimal fallback
    return (
      <div className="rounded border border-red-700/50 bg-red-950/20 p-2">
        <p className="text-sm text-red-300">⚠️ Error occurred</p>
        {isDevelopment && <p className="text-xs text-neutral-400">{errorMessage}</p>}
      </div>
    );
  }

  override render() {
    if (this.state.hasError) {
      return this.renderFallback();
    }

    return this.props.children;
  }
}

/**
 * Hook-based wrapper for functional components
 */
export function useErrorBoundary(fallbackType?: Props['fallbackType']) {
  return {
    ErrorBoundary: ({ children, ...props }: Omit<Props, 'fallbackType'>) => (
      <WorkspaceErrorBoundary fallbackType={fallbackType} {...props}>
        {children}
      </WorkspaceErrorBoundary>
    ),
  };
}

export default WorkspaceErrorBoundary;
