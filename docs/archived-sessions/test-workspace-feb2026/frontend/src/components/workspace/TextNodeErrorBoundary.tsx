'use client';

/**
 * Text Node Error Boundary
 *
 * Specialized error boundary wrapper for individual TextNode components.
 * Prevents a single node crash from taking down the entire workspace.
 *
 * Features:
 * - Catches errors in TextNode rendering
 * - Shows inline error UI in place of the crashed node
 * - Preserves node position and size for visual consistency
 * - Provides delete button to remove the broken node
 * - Logs detailed error info with node context
 *
 * Usage:
 * ```tsx
 * <TextNodeErrorBoundary
 *   nodeId={node.id}
 *   position={node.position}
 *   size={node.size}
 *   onDelete={() => handleNodeDelete(node.id)}
 * >
 *   <TextNode {...props} />
 * </TextNodeErrorBoundary>
 * ```
 */

import React from 'react';
import { WorkspaceErrorBoundary } from './WorkspaceErrorBoundary';
import { logger } from '@/lib/utils/logger';

interface TextNodeErrorBoundaryProps {
  children: React.ReactNode;
  nodeId: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  onDelete?: () => void;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

export function TextNodeErrorBoundary({
  children,
  nodeId,
  position,
  size,
  onDelete,
  onError,
}: TextNodeErrorBoundaryProps) {
  const fallbackUI = (
    <div
      className="absolute flex items-center justify-center rounded border-2 border-dashed border-red-700/50 bg-red-950/20 p-4"
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
        minHeight: '100px',
        minWidth: '200px',
      }}
      data-node-id={nodeId}
      data-error-state="true"
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
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <p className="mb-1 text-sm font-medium text-red-300">Node Error</p>
        <p className="mb-3 text-xs text-neutral-400">This node couldn't be rendered</p>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => window.location.reload()}
            className="rounded bg-red-700 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-red-600"
          >
            Reload Page
          </button>
          {onDelete && (
            <button
              onClick={onDelete}
              className="rounded border border-red-700/50 bg-transparent px-3 py-1 text-xs font-medium text-red-300 transition-colors hover:bg-red-900/20"
            >
              Delete Node
            </button>
          )}
        </div>
        {process.env.NODE_ENV === 'development' && (
          <p className="mt-3 text-xs text-neutral-500">Node ID: {nodeId}</p>
        )}
      </div>
    </div>
  );

  return (
    <WorkspaceErrorBoundary
      fallbackType="node"
      fallback={fallbackUI}
      nodeId={nodeId}
      onError={(error, errorInfo) => {
        logger.error('TextNode error:', {
          nodeId,
          error,
          errorInfo,
          position,
          size,
        });
        onError?.(error, errorInfo);
      }}
    >
      {children}
    </WorkspaceErrorBoundary>
  );
}

export default TextNodeErrorBoundary;
