'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { HybridMarkdownRenderer } from '@/components/ui/HybridMarkdownRenderer';
import { TraceTiptapEditor } from './TraceTiptapEditor';
import { logger } from '@/lib/utils/logger';

interface TracingContentViewerProps {
  /** AI-generated background content (markdown) - the original reference */
  backgroundContent: string;
  /** User's traced/edited content - the editable layer */
  tracedContent?: string;
  /** Whether the user is an admin (can see background and edit) */
  isAdmin: boolean;
  /** Project slug for API calls */
  projectSlug: string;
  /** Callback when traced content changes */
  onTracedContentChange?: (content: string) => void;
  /** Callback to save traced content */
  onSave?: (content: string) => Promise<void>;
  /** Custom class name */
  className?: string;
  /** External control of tracing mode */
  isTracingMode?: boolean;
  /** Callback when tracing mode changes */
  onTracingModeChange?: (isTracing: boolean) => void;
}

/**
 * TracingContentViewer - Full-document inline editing overlay.
 *
 * Like tracing paper: the background (AI content) is dimmed underneath,
 * and you edit directly on top. Your edits persist as the traced layer.
 */
export function TracingContentViewer({
  backgroundContent,
  tracedContent,
  isAdmin,
  projectSlug,
  onTracedContentChange,
  onSave,
  className = '',
  isTracingMode = false,
}: TracingContentViewerProps) {
  // Start with traced content if exists, otherwise empty
  const [localContent, setLocalContent] = useState(tracedContent || '');
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Update local content when props change
  useEffect(() => {
    if (tracedContent !== undefined) {
      setLocalContent(tracedContent);
    }
  }, [tracedContent]);

  // Handle editor changes (receives markdown string directly)
  const handleChange = useCallback(
    (newContent: string) => {
      setLocalContent(newContent);
      setHasChanges(true);
      onTracedContentChange?.(newContent);
    },
    [onTracedContentChange]
  );

  // Auto-save on blur or Ctrl+S
  const handleSave = useCallback(async () => {
    if (!hasChanges || !onSave) return;

    setIsSaving(true);
    try {
      await onSave(localContent);
      setHasChanges(false);
    } catch (error) {
      logger.error('Failed to save traced content:', error);
    } finally {
      setIsSaving(false);
    }
  }, [localContent, hasChanges, onSave]);

  // For public view: show traced content with grayed background visible underneath
  if (!isAdmin) {
    // If there's traced content, show it with the grayed background underneath
    if (tracedContent) {
      return (
        <div className={`relative h-full ${className}`}>
          {/* Background Layer - AI content reference (dimmed) */}
          <div className="absolute inset-0 overflow-y-auto px-4 py-3 sm:px-6 sm:py-4">
            <div className="pointer-events-none select-none opacity-15">
              <HybridMarkdownRenderer
                content={backgroundContent}
                className="prose prose-sm prose-invert max-w-none text-gray-500 sm:prose-base"
              />
            </div>
          </div>

          {/* Foreground Layer - Traced content */}
          <div className="relative h-full overflow-y-auto px-4 py-3 sm:px-6 sm:py-4">
            <HybridMarkdownRenderer
              content={tracedContent}
              className="prose prose-sm prose-invert max-w-none sm:prose-base"
            />
          </div>
        </div>
      );
    }

    // No traced content yet - show background at reduced opacity with indicator
    return (
      <div className={`relative h-full ${className}`}>
        <div className="h-full overflow-y-auto px-4 py-3 opacity-40 sm:px-6 sm:py-4">
          <HybridMarkdownRenderer
            content={backgroundContent}
            className="prose prose-sm prose-invert max-w-none sm:prose-base"
          />
        </div>
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-gray-800/80 px-3 py-1 text-xs text-gray-400">
          AI-generated content - human edits coming soon
        </div>
      </div>
    );
  }

  // Admin view - trace mode shows editor, otherwise shows rendered content
  if (isTracingMode) {
    return (
      <div className={`relative flex h-full ${className}`}>
        {/* Background Layer - AI content reference (dimmed) */}
        <div className="absolute inset-0 overflow-y-auto px-4 py-3 sm:px-6 sm:py-4">
          <div className="pointer-events-none select-none opacity-15">
            <HybridMarkdownRenderer
              content={backgroundContent}
              className="prose prose-sm prose-invert max-w-none text-gray-500 sm:prose-base"
            />
          </div>
        </div>

        {/* Foreground Layer - Editable traced content */}
        <div className="relative flex h-full w-full flex-col">
          {/* Status bar */}
          <div className="flex items-center justify-between border-b border-purple-500/30 bg-purple-900/20 px-4 py-1.5 text-xs">
            <span className="text-purple-300">
              Trace Mode: Edit directly. Background shows original for reference.
            </span>
            <div className="flex items-center gap-2">
              {hasChanges && <span className="text-yellow-400">Unsaved changes</span>}
              {isSaving && <span className="text-blue-400">Saving...</span>}
              <span className="text-gray-500">Ctrl/Cmd+S to save</span>
            </div>
          </div>

          {/* WYSIWYG Editor - styled to match background rendering */}
          <div className="flex-1 overflow-y-auto px-4 py-3 sm:px-6 sm:py-4">
            <TraceTiptapEditor
              content={localContent}
              onChange={handleChange}
              onBlur={handleSave}
              placeholder="Start typing to trace over the background content..."
            />
          </div>
        </div>
      </div>
    );
  }

  // View mode - show traced content (or background if empty)
  const displayContent = localContent || backgroundContent;
  const showingBackground = !localContent;

  return (
    <div className={`relative h-full ${className}`}>
      {/* Background reference layer (always visible but very dim when traced content exists) */}
      {localContent && (
        <div className="absolute inset-0 overflow-y-auto px-4 py-3 sm:px-6 sm:py-4">
          <div className="pointer-events-none select-none opacity-10">
            <HybridMarkdownRenderer
              content={backgroundContent}
              className="prose prose-sm prose-invert max-w-none text-gray-600 sm:prose-base"
            />
          </div>
        </div>
      )}

      {/* Main content layer */}
      <div
        className={`relative h-full overflow-y-auto px-4 py-3 sm:px-6 sm:py-4 ${
          showingBackground ? 'opacity-40' : ''
        }`}
      >
        <HybridMarkdownRenderer
          content={displayContent}
          className="prose prose-sm prose-invert max-w-none sm:prose-base"
        />
      </div>

      {/* Indicator when showing background only */}
      {showingBackground && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-gray-800/80 px-3 py-1 text-xs text-gray-400">
          Showing AI background - click Trace to start editing
        </div>
      )}
    </div>
  );
}
